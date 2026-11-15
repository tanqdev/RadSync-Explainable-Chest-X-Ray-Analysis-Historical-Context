import base64
import json
import os
import sqlite3
from io import BytesIO
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from Server.services.predictor import (
    CLASSES,
    THRESHOLDS,
    gradcam_map,
    predict_image,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INDEX_PATH = PROJECT_ROOT / "data" / "mimic_index.sqlite"
LABEL_WEIGHT = 0.65
REGION_WEIGHT = 0.35
UNCERTAINTY_DELTA = float(os.getenv("RADSYN_UNCERTAINTY_DELTA", "0.12"))


def get_index_path() -> Path:
    configured = os.getenv("RADSYN_MIMIC_INDEX")
    return Path(configured).expanduser().resolve() if configured else DEFAULT_INDEX_PATH


def select_retrieval_class(scores: dict[str, float]) -> tuple[str, float]:
    disease = min(CLASSES, key=lambda name: abs(float(scores[name]) - THRESHOLDS[name]))
    return disease, abs(float(scores[disease]) - THRESHOLDS[disease])


def _unit(vector: np.ndarray) -> np.ndarray:
    vector = np.asarray(vector, dtype=np.float32)
    norm = float(np.linalg.norm(vector))
    return vector / norm if norm > 1e-8 else vector


def region_descriptor(image: Image.Image, disease: str) -> list[float]:
    cam, _ = gradcam_map(image, disease)
    cam = np.asarray(cam, dtype=np.float32)
    peak = float(cam.max()) if cam.size else 0.0
    if peak <= 1e-8:
        mask = np.zeros_like(cam, dtype=bool)
        mask.flat[int(np.argmax(cam))] = True
    else:
        threshold = max(0.35 * peak, float(np.quantile(cam, 0.80)))
        mask = cam >= threshold
        if not mask.any():
            mask.flat[int(np.argmax(cam))] = True

    ys, xs = np.where(mask)
    height, width = cam.shape
    cx = float(xs.mean() / max(width - 1, 1))
    cy = float(ys.mean() / max(height - 1, 1))
    area = float(mask.mean())

    quadrants = [0.0, 0.0, 0.0, 0.0]
    quadrant_index = (0 if cy < 0.5 else 2) + (0 if cx < 0.5 else 1)
    quadrants[quadrant_index] = 1.0
    return _unit(np.array([cx, cy, area, *quadrants], dtype=np.float32)).tolist()


def _label_vector(scores: dict[str, float]) -> list[float]:
    return _unit(np.array([float(scores[name]) for name in CLASSES], dtype=np.float32)).tolist()


def _make_thumbnail(image_path: str) -> str | None:
    try:
        with Image.open(image_path) as image:
            image = image.convert("RGB")
            image.thumbnail((384, 384))
            buffer = BytesIO()
            image.save(buffer, format="JPEG", quality=68, optimize=True)
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"
    except (OSError, ValueError):
        return None


def retrieve_similar_cases(image: Image.Image, top_k: int = 5) -> dict[str, Any]:
    index_path = get_index_path()
    if not index_path.is_file():
        raise FileNotFoundError(
            f"MIMIC-CXR retrieval index not found at {index_path}. Build it with ml/build_mimic_index.py."
        )

    query_scores = predict_image(image)
    retrieval_class, margin = select_retrieval_class(query_scores)
    if margin > UNCERTAINTY_DELTA:
        return {
            "triggered": False,
            "reason": "No disease probability is sufficiently close to its validation threshold.",
            "retrieval_class": retrieval_class,
            "threshold_margin": round(margin, 4),
            "cases": [],
        }

    query_labels = np.asarray(_label_vector(query_scores), dtype=np.float32)
    query_region = np.asarray(region_descriptor(image, retrieval_class), dtype=np.float32)

    conn = sqlite3.connect(str(index_path))
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT case_id, image_path, report_text, label_vector, region_vector
            FROM historical_cases
            WHERE retrieval_class = ?
            """,
            (retrieval_class,),
        ).fetchall()
    finally:
        conn.close()

    ranked = []
    for row in rows:
        try:
            candidate_labels = np.asarray(json.loads(row["label_vector"]), dtype=np.float32)
            candidate_region = np.asarray(json.loads(row["region_vector"]), dtype=np.float32)
            label_similarity = float(np.dot(query_labels, candidate_labels))
            region_similarity = float(np.dot(query_region, candidate_region))
            similarity = LABEL_WEIGHT * label_similarity + REGION_WEIGHT * region_similarity
            ranked.append((similarity, row))
        except (ValueError, TypeError, json.JSONDecodeError):
            continue

    ranked.sort(key=lambda item: item[0], reverse=True)
    cases = []
    for similarity, row in ranked[: max(1, min(int(top_k), 10))]:
        cases.append({
            "id": str(row["case_id"]),
            "similarity": round(max(0.0, min(1.0, similarity)) * 100, 1),
            "finding": retrieval_class,
            "report": (row["report_text"] or "")[:12000],
            "date": "De-identified MIMIC-CXR reference study",
            "image": _make_thumbnail(row["image_path"]),
        })

    return {
        "triggered": True,
        "reason": "Historical retrieval triggered by a disease probability near its validation threshold.",
        "retrieval_class": retrieval_class,
        "threshold_margin": round(margin, 4),
        "cases": cases,
    }

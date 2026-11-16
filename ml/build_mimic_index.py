import argparse
import csv
import json
import os
import sqlite3
from pathlib import Path

from PIL import Image

from Server.services.predictor import predict_image
from Server.services.retrieval import (
    _label_vector,
    get_mimic_index_path,
    region_descriptor,
    select_retrieval_class,
)


def report_path_for(report_root: Path, subject_id: str, study_id: str) -> Path:
    subject = f"p{int(subject_id)}"
    prefix = f"p{str(int(subject_id))[:2]}"
    return report_root / "files" / prefix / subject / f"s{int(study_id)}.txt"


def image_path_for(image_root: Path, row: dict[str, str]) -> Path:
    relative = (row.get("path") or "").strip()
    if relative:
        path = Path(relative)
        return path if path.is_absolute() else image_root / path
    subject_id = str(int(row["subject_id"]))
    study_id = str(int(row["study_id"]))
    dicom_id = row["dicom_id"]
    prefix = f"p{subject_id[:2]}"
    return image_root / "files" / prefix / f"p{subject_id}" / f"s{study_id}" / f"{dicom_id}.jpg"


def read_report(path: Path) -> str:
    if not path.is_file():
        return ""
    try:
        return path.read_text(encoding="utf-8", errors="replace").strip()[:12000]
    except OSError:
        return ""


def main():
    parser = argparse.ArgumentParser(description="Build a RadSyn MIMIC-CXR historical retrieval index.")
    parser.add_argument("--metadata-csv", required=True, type=Path)
    parser.add_argument("--image-root", required=True, type=Path, help="MIMIC-CXR-JPG directory containing files/.")
    parser.add_argument("--reports-root", type=Path, help="MIMIC-CXR reports directory containing files/. Defaults to --image-root.")
    parser.add_argument("--limit", type=int, default=1000, help="Maximum number of PA/AP studies to index (default: 1000).")
    parser.add_argument("--index-path", type=Path, default=get_mimic_index_path())
    parser.add_argument("--views", nargs="+", default=["PA", "AP"])
    args = parser.parse_args()

    image_root = args.image_root.expanduser().resolve()
    reports_root = (args.reports_root or args.image_root).expanduser().resolve()
    metadata_path = args.metadata_csv.expanduser().resolve()
    index_path = args.index_path.expanduser().resolve()
    if not metadata_path.is_file():
        raise FileNotFoundError(f"Metadata CSV not found: {metadata_path}")
    index_path.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(str(index_path))
    connection.execute("""
        CREATE TABLE IF NOT EXISTS historical_cases (
            case_id TEXT PRIMARY KEY,
            retrieval_class TEXT NOT NULL,
            label_vector TEXT NOT NULL,
            region_vector TEXT NOT NULL,
            image_path TEXT NOT NULL,
            report_text TEXT NOT NULL
        )
    """)
    connection.execute("CREATE INDEX IF NOT EXISTS idx_historical_retrieval_class ON historical_cases(retrieval_class)")
    connection.commit()

    inserted = 0
    skipped = 0
    processed = 0
    with metadata_path.open("r", newline="", encoding="utf-8-sig") as stream:
        reader = csv.DictReader(stream)
        required = {"subject_id", "study_id", "dicom_id"}
        if not required.issubset(set(reader.fieldnames or [])):
            raise ValueError(f"Metadata CSV must include columns: {', '.join(sorted(required))}")

        for row in reader:
            view = (row.get("ViewPosition") or row.get("view_position") or "").upper()
            if view and view not in {value.upper() for value in args.views}:
                continue
            if processed >= max(1, args.limit):
                break
            processed += 1

            try:
                image_path = image_path_for(image_root, row).resolve()
                report_file = report_path_for(reports_root, row["subject_id"], row["study_id"])
                report_text = read_report(report_file)
                if not image_path.is_file() or not report_text:
                    skipped += 1
                    continue

                with Image.open(image_path) as source:
                    image = source.convert("RGB")
                scores = predict_image(image)
                retrieval_class, _ = select_retrieval_class(scores)
                labels = _label_vector(scores)
                region = region_descriptor(image, retrieval_class)

                connection.execute(
                    """
                    INSERT OR REPLACE INTO historical_cases
                    (case_id, retrieval_class, label_vector, region_vector, image_path, report_text)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(row["dicom_id"]),
                        retrieval_class,
                        json.dumps(labels),
                        json.dumps(region),
                        str(image_path),
                        report_text,
                    ),
                )
                inserted += 1
                if inserted % 25 == 0:
                    connection.commit()
                    print(f"Indexed {inserted} studies (skipped: {skipped})")
            except (OSError, ValueError, KeyError) as exc:
                skipped += 1
                print(f"Skipping {row.get('dicom_id', 'unknown')}: {exc}")

    connection.commit()
    connection.close()
    print(f"Index complete: {inserted} indexed, {skipped} skipped")
    print(f"SQLite index: {index_path}")


if __name__ == "__main__":
    main()

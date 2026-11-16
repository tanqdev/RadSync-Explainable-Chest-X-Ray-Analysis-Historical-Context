"""Build a local retrieval index from the Indiana University (Open-i) chest X-ray data.

The dataset stays outside this repository. Only derived vectors, local file paths,
and de-identified report text are written to the SQLite index.
"""

import argparse
import csv
import json
import sqlite3
import time
from pathlib import Path

from PIL import Image

from Server.services.predictor import predict_image
from Server.services.retrieval import (
    _label_vector,
    region_descriptor,
    select_retrieval_class,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def read_reports(path: Path) -> dict[str, dict[str, str]]:
    with path.open("r", newline="", encoding="utf-8-sig") as stream:
        reader = csv.DictReader(stream)
        required = {"uid", "indication", "comparison", "findings", "impression"}
        missing = required.difference(reader.fieldnames or [])
        if missing:
            raise ValueError(
                f"Reports CSV is missing columns: {', '.join(sorted(missing))}"
            )
        return {
            row["uid"].strip(): row
            for row in reader
            if (row.get("uid") or "").strip()
        }


def format_report(row: dict[str, str], uid: str) -> str:
    fields = (
        ("Indication", "indication"),
        ("Comparison", "comparison"),
        ("Findings", "findings"),
        ("Impression", "impression"),
        ("MeSH terms", "MeSH"),
        ("Problems", "Problems"),
    )
    parts = [
        "Source: Indiana University Chest X-ray dataset (Open-i)",
        f"Case UID: {uid}",
    ]
    for label, key in fields:
        value = (row.get(key) or "").strip()
        if value:
            parts.append(f"{label}: {value}")
    return "\n\n".join(parts)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build/resume the RadSyn Indiana University retrieval index."
    )
    parser.add_argument(
        "--reports-csv",
        type=Path,
        default=Path(r"D:\archive\indiana_reports.csv"),
    )
    parser.add_argument(
        "--projections-csv",
        type=Path,
        default=Path(r"D:\archive\indiana_projections.csv"),
    )
    parser.add_argument(
        "--image-root",
        type=Path,
        default=Path(r"D:\archive\images\images_normalized"),
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        help="Maximum number of new frontal images to attempt in this run (default: 50).",
    )
    parser.add_argument(
        "--index-path",
        type=Path,
        default=PROJECT_ROOT / "data" / "iu_index.sqlite",
    )
    args = parser.parse_args()

    if args.limit < 1:
        parser.error("--limit must be at least 1.")

    reports_csv = args.reports_csv.expanduser().resolve()
    projections_csv = args.projections_csv.expanduser().resolve()
    image_root = args.image_root.expanduser().resolve()
    index_path = args.index_path.expanduser().resolve()

    for path in (reports_csv, projections_csv):
        if not path.is_file():
            raise FileNotFoundError(f"CSV not found: {path}")
    if not image_root.is_dir():
        raise FileNotFoundError(f"Image directory not found: {image_root}")

    reports = read_reports(reports_csv)
    index_path.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(str(index_path))
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS historical_cases (
            case_id TEXT PRIMARY KEY,
            retrieval_class TEXT NOT NULL,
            label_vector TEXT NOT NULL,
            region_vector TEXT NOT NULL,
            image_path TEXT NOT NULL,
            report_text TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_historical_retrieval_class
        ON historical_cases(retrieval_class)
        """
    )
    connection.commit()

    attempted = 0
    inserted = 0
    skipped = 0
    already_indexed = 0
    started = time.perf_counter()

    try:
        with projections_csv.open(
            "r", newline="", encoding="utf-8-sig"
        ) as stream:
            reader = csv.DictReader(stream)
            required = {"uid", "filename", "projection"}
            missing = required.difference(reader.fieldnames or [])
            if missing:
                raise ValueError(
                    "Projections CSV is missing columns: "
                    + ", ".join(sorted(missing))
                )

            for projection in reader:
                if (projection.get("projection") or "").strip().lower() != "frontal":
                    continue

                uid = (projection.get("uid") or "").strip()
                filename = Path(projection.get("filename") or "").name
                if not uid or not filename:
                    skipped += 1
                    continue

                case_id = f"IU-{uid}-{Path(filename).stem}"
                exists = connection.execute(
                    "SELECT 1 FROM historical_cases WHERE case_id = ?",
                    (case_id,),
                ).fetchone()
                if exists:
                    already_indexed += 1
                    continue

                if attempted >= args.limit:
                    break
                attempted += 1

                image_path = image_root / filename
                report = reports.get(uid)
                if not image_path.is_file() or report is None:
                    skipped += 1
                    print(f"Skipping {filename}: missing image or report for UID {uid}")
                    continue

                try:
                    with Image.open(image_path) as source:
                        image = source.convert("RGB")

                    scores = predict_image(image)
                    retrieval_class, _ = select_retrieval_class(scores)
                    labels = _label_vector(scores)
                    region = region_descriptor(image, retrieval_class)
                    report_text = format_report(report, uid)

                    connection.execute(
                        """
                        INSERT OR REPLACE INTO historical_cases
                        (case_id, retrieval_class, label_vector, region_vector,
                         image_path, report_text)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (
                            case_id,
                            retrieval_class,
                            json.dumps(labels),
                            json.dumps(region),
                            str(image_path),
                            report_text,
                        ),
                    )
                    inserted += 1

                    if inserted % 10 == 0:
                        connection.commit()
                        elapsed = time.perf_counter() - started
                        print(
                            f"Indexed {inserted} new images in {elapsed:.1f}s "
                            f"(already present: {already_indexed}, skipped: {skipped})"
                        )

                except Exception as exc:
                    skipped += 1
                    print(f"Skipping {filename}: {type(exc).__name__}: {exc}")

        connection.commit()
        total = connection.execute(
            "SELECT COUNT(*) FROM historical_cases"
        ).fetchone()[0]
        elapsed = time.perf_counter() - started

        print("\nIndiana University index build complete.")
        print(f"New images attempted: {attempted}")
        print(f"Inserted this run: {inserted}")
        print(f"Already indexed: {already_indexed}")
        print(f"Skipped: {skipped}")
        print(f"Total indexed cases: {total}")
        print(f"Elapsed: {elapsed:.1f}s")
        print(f"SQLite index: {index_path}")

    finally:
        connection.close()


if __name__ == "__main__":
    main()

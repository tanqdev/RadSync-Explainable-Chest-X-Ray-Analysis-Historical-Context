"""Evaluate saved multi-label test predictions without re-running image inference.

This is useful when the original NIH image archive is unavailable but the
previously saved test_predictions.npz and validation-selected thresholds.csv
are still present.
"""

import argparse
import csv
import json
from pathlib import Path

import numpy as np
from sklearn.metrics import roc_auc_score

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PREDICTIONS = PROJECT_ROOT / "ml" / "evaluation" / "test_predictions.npz"
DEFAULT_THRESHOLDS = PROJECT_ROOT / "ml" / "evaluation" / "thresholds.csv"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "ml" / "evaluation"
CLASSES = ("Atelectasis", "Effusion", "Infiltration", "Mass", "Nodule")


def load_thresholds(path: Path) -> dict[str, float]:
    with path.open("r", newline="", encoding="utf-8-sig") as stream:
        reader = csv.DictReader(stream)
        if not reader.fieldnames or not {"Disease", "Threshold"}.issubset(reader.fieldnames):
            raise ValueError("Threshold CSV must contain Disease and Threshold columns.")
        thresholds = {}
        for row in reader:
            name = (row.get("Disease") or "").strip()
            if not name:
                continue
            value = float(row["Threshold"])
            if not 0.0 <= value <= 1.0:
                raise ValueError("Threshold for {} must be between 0 and 1.".format(name))
            thresholds[name] = value

    missing = [name for name in CLASSES if name not in thresholds]
    if missing:
        raise ValueError("Threshold CSV is missing classes: {}".format(", ".join(missing)))
    return thresholds


def _safe_divide(numerator: int, denominator: int) -> float:
    return float(numerator / denominator) if denominator else 0.0


def evaluate_arrays(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    thresholds: dict[str, float],
) -> tuple[dict, list[dict]]:
    y_true = np.asarray(y_true)
    y_prob = np.asarray(y_prob, dtype=np.float64)

    if y_true.ndim != 2 or y_prob.ndim != 2:
        raise ValueError("y_true and y_prob must both be 2D arrays.")
    if y_true.shape != y_prob.shape:
        raise ValueError("y_true and y_prob must have identical shapes.")
    if y_true.shape[1] != len(CLASSES):
        raise ValueError("Expected exactly {} disease columns.".format(len(CLASSES)))
    if y_true.shape[0] == 0:
        raise ValueError("The saved test prediction array is empty.")
    if not np.isfinite(y_true).all() or not np.isfinite(y_prob).all():
        raise ValueError("Prediction arrays contain NaN or infinite values.")
    if not np.isin(y_true, (0, 1)).all():
        raise ValueError("Ground-truth labels must contain only 0 and 1.")
    if ((y_prob < 0.0) | (y_prob > 1.0)).any():
        raise ValueError("Predicted probabilities must be between 0 and 1.")

    missing = [name for name in CLASSES if name not in thresholds]
    if missing:
        raise ValueError("Thresholds missing classes: {}".format(", ".join(missing)))

    threshold_vector = np.asarray([thresholds[name] for name in CLASSES])
    y_pred = (y_prob >= threshold_vector).astype(np.int8)
    y_true = y_true.astype(np.int8)

    rows = []
    auc_values = []
    accuracy_values = []
    precision_values = []
    recall_values = []
    f1_values = []
    total_tp = total_fp = total_fn = 0

    for index, disease in enumerate(CLASSES):
        truth = y_true[:, index]
        predicted = y_pred[:, index]
        tp = int(np.sum((truth == 1) & (predicted == 1)))
        tn = int(np.sum((truth == 0) & (predicted == 0)))
        fp = int(np.sum((truth == 0) & (predicted == 1)))
        fn = int(np.sum((truth == 1) & (predicted == 0)))

        accuracy = _safe_divide(tp + tn, len(truth))
        precision = _safe_divide(tp, tp + fp)
        recall = _safe_divide(tp, tp + fn)
        specificity = _safe_divide(tn, tn + fp)
        f1 = _safe_divide(2 * precision * recall, precision + recall)

        try:
            auc = float(roc_auc_score(truth, y_prob[:, index]))
        except ValueError:
            auc = None

        if auc is not None:
            auc_values.append(auc)
        accuracy_values.append(accuracy)
        precision_values.append(precision)
        recall_values.append(recall)
        f1_values.append(f1)
        total_tp += tp
        total_fp += fp
        total_fn += fn

        rows.append({
            "disease": disease,
            "threshold": float(thresholds[disease]),
            "support_positive": int(np.sum(truth == 1)),
            "support_negative": int(np.sum(truth == 0)),
            "accuracy": accuracy,
            "precision": precision,
            "recall_sensitivity": recall,
            "specificity": specificity,
            "f1": f1,
            "roc_auc": auc,
            "true_positive": tp,
            "true_negative": tn,
            "false_positive": fp,
            "false_negative": fn,
        })

    micro_precision = _safe_divide(total_tp, total_tp + total_fp)
    micro_recall = _safe_divide(total_tp, total_tp + total_fn)
    micro_f1 = _safe_divide(
        2 * micro_precision * micro_recall,
        micro_precision + micro_recall,
    )

    summary = {
        "evaluation_split": "held-out test split",
        "num_images": int(y_true.shape[0]),
        "num_classes": len(CLASSES),
        "class_order": list(CLASSES),
        "threshold_source": "thresholds selected using validation data",
        "macro_class_accuracy": float(np.mean(accuracy_values)),
        "exact_match_accuracy": float(np.mean(np.all(y_true == y_pred, axis=1))),
        "macro_precision": float(np.mean(precision_values)),
        "macro_recall_sensitivity": float(np.mean(recall_values)),
        "macro_f1": float(np.mean(f1_values)),
        "macro_roc_auc": float(np.mean(auc_values)) if auc_values else None,
        "micro_precision": micro_precision,
        "micro_recall": micro_recall,
        "micro_f1": micro_f1,
        "per_class": rows,
        "notes": [
            "Macro class accuracy is the mean of the five one-vs-rest accuracies; it includes true negatives.",
            "Exact-match accuracy counts an image as correct only when all five labels match.",
            "ROC-AUC evaluates ranking across thresholds; F1 and accuracy use validation-selected thresholds.",
            "These are dataset metrics, not evidence of clinical readiness or diagnostic safety.",
        ],
    }
    return summary, rows


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Calculate multi-label metrics from saved test predictions."
    )
    parser.add_argument("--predictions", type=Path, default=DEFAULT_PREDICTIONS)
    parser.add_argument("--thresholds", type=Path, default=DEFAULT_THRESHOLDS)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args()

    predictions_path = args.predictions.expanduser().resolve()
    thresholds_path = args.thresholds.expanduser().resolve()
    output_dir = args.output_dir.expanduser().resolve()

    if not predictions_path.is_file():
        raise FileNotFoundError("Saved predictions not found: {}".format(predictions_path))
    if not thresholds_path.is_file():
        raise FileNotFoundError("Threshold file not found: {}".format(thresholds_path))

    with np.load(predictions_path, allow_pickle=False) as saved:
        required = {"y_true", "y_prob"}
        missing = required.difference(saved.files)
        if missing:
            raise ValueError("NPZ file is missing arrays: {}".format(", ".join(sorted(missing))))
        y_true = saved["y_true"]
        y_prob = saved["y_prob"]

    summary, rows = evaluate_arrays(y_true, y_prob, load_thresholds(thresholds_path))
    output_dir.mkdir(parents=True, exist_ok=True)

    summary_path = output_dir / "test_metrics_summary.json"
    class_path = output_dir / "test_metrics_by_class.csv"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    with class_path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    print("RadSync saved-prediction evaluation")
    print("===================================")
    print("Test images: {}".format(summary["num_images"]))
    print("Macro class accuracy : {:.4%}".format(summary["macro_class_accuracy"]))
    print("Exact-match accuracy: {:.4%}".format(summary["exact_match_accuracy"]))
    print("Macro precision      : {:.4f}".format(summary["macro_precision"]))
    print("Macro recall         : {:.4f}".format(summary["macro_recall_sensitivity"]))
    print("Macro F1             : {:.4f}".format(summary["macro_f1"]))
    if summary["macro_roc_auc"] is not None:
        print("Macro ROC-AUC        : {:.4f}".format(summary["macro_roc_auc"]))
    print()
    print("Per-class results:")
    for row in rows:
        auc = "n/a" if row["roc_auc"] is None else "{:.4f}".format(row["roc_auc"])
        print(
            "  {} | accuracy={:.4%} | precision={:.4f} | recall={:.4f} "
            "| F1={:.4f} | ROC-AUC={}".format(
                row["disease"],
                row["accuracy"],
                row["precision"],
                row["recall_sensitivity"],
                row["f1"],
                auc,
            )
        )
    print()
    print("Wrote:")
    print(summary_path)
    print(class_path)


if __name__ == "__main__":
    main()

"""Evaluate IU historical retrieval with leave-one-out, report-derived weak labels.

This script does not run the classifier or Grad-CAM. It uses the vectors already
stored in data/iu_index.sqlite and report text stored alongside each case.

Weak relevance states come from explicit disease mentions in structured MeSH /
Problems fields and explicit positive/negative mentions in Findings / Impression.
Unmentioned conditions are UNJUDGED, not automatically negative.
"""

import argparse
import csv
import json
import math
import re
import sqlite3
from collections import defaultdict
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INDEX = PROJECT_ROOT / "data" / "iu_index.sqlite"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "iu_retrieval_evaluation"
CLASSES = ("Atelectasis", "Effusion", "Infiltration", "Mass", "Nodule")

# Keep these aligned with Server/services/retrieval.py.
LABEL_WEIGHT = 0.65
REGION_WEIGHT = 0.35
DEFAULT_KS = (1, 3, 5, 10)

FIELD_RE = re.compile(
    r"^\s*(Source|Case UID|Indication|Comparison|Findings|Impression|MeSH terms|Problems)\s*:\s*(.*)$",
    re.IGNORECASE,
)
NEGATION_RE = re.compile(
    r"\b(?:no|without|absent|absence of|negative for|no evidence of|free of|"
    r"not demonstrate|not demonstrated|not show|not seen|not identified|not evident)\b",
    re.IGNORECASE,
)
CONTRAST_RE = re.compile(r"\b(?:but|however|although|yet|except)\b", re.IGNORECASE)

DISEASE_PATTERNS = {
    "Atelectasis": re.compile(
        r"\b(?:atelectasis|atelectatic|pulmonary collapse|lung collapse)\b",
        re.IGNORECASE,
    ),
    "Effusion": re.compile(r"\b(?:pleural\s+)?effusions?\b", re.IGNORECASE),
    "Infiltration": re.compile(
        r"\b(?:infiltrate|infiltrates|infiltrated|infiltration|infiltrations)\b",
        re.IGNORECASE,
    ),
    "Mass": re.compile(r"\bmass(?:es)?\b", re.IGNORECASE),
    "Nodule": re.compile(r"\bnodul(?:e|es|ar)\b", re.IGNORECASE),
}


def parse_report_fields(report_text):
    fields = {}
    current = None
    for line in (report_text or "").splitlines():
        match = FIELD_RE.match(line)
        if match:
            current = match.group(1).lower()
            fields.setdefault(current, [])
            if match.group(2).strip():
                fields[current].append(match.group(2).strip())
        elif current and line.strip():
            fields[current].append(line.strip())
    return {key: " ".join(values) for key, values in fields.items()}


def mention_is_negated(text, match_start):
    """Conservative local negation check within the current clause."""
    prefix = text[:match_start]
    # Do not carry a negation across a sentence or semicolon boundary.
    clause = re.split(r"[.!?;]", prefix)[-1]
    negations = list(NEGATION_RE.finditer(clause))
    if not negations:
        return False
    contrasts = list(CONTRAST_RE.finditer(clause))
    last_negation = negations[-1].end()
    last_contrast = contrasts[-1].end() if contrasts else -1
    return last_negation > last_contrast


def weak_label_states(report_text):
    """Return positive / negative / unknown states derived from report text.

    MeSH and Problems matches count as weak positive labels. Findings and
    Impression may provide explicit positive or negated mentions. An absent
    mention is left unknown rather than assumed to be a negative label.
    """
    fields = parse_report_fields(report_text)
    structured = " ".join(
        (fields.get("mesh terms", ""), fields.get("problems", ""))
    )
    narrative = " ".join(
        (fields.get("findings", ""), fields.get("impression", ""))
    )

    states = {}
    for disease in CLASSES:
        pattern = DISEASE_PATTERNS[disease]
        structured_positive = bool(pattern.search(structured))
        narrative_positive = False
        narrative_negative = False

        for match in pattern.finditer(narrative):
            if mention_is_negated(narrative, match.start()):
                narrative_negative = True
            else:
                narrative_positive = True

        if structured_positive or narrative_positive:
            states[disease] = "positive"
        elif narrative_negative:
            states[disease] = "negative"
        else:
            states[disease] = "unknown"
    return states


def dot_product(left, right):
    if not isinstance(left, list) or not isinstance(right, list) or len(left) != len(right):
        raise ValueError("Stored feature vectors have incompatible dimensions.")
    return sum(float(a) * float(b) for a, b in zip(left, right))


def ranking_metrics(relevance, k):
    """Binary Precision@K, Recall@K, AP@K and NDCG@K for a ranked list."""
    if not relevance:
        return None
    evaluated_k = min(k, len(relevance))
    hits = [1 if value else 0 for value in relevance[:evaluated_k]]
    hit_count = sum(hits)
    total_relevant = sum(1 for value in relevance if value)
    precision = hit_count / evaluated_k
    recall = hit_count / total_relevant if total_relevant else 0.0

    precision_sum = 0.0
    running_hits = 0
    for rank, is_relevant in enumerate(hits, start=1):
        if is_relevant:
            running_hits += 1
            precision_sum += running_hits / rank
    ap_denominator = min(total_relevant, evaluated_k)
    average_precision = precision_sum / ap_denominator if ap_denominator else 0.0

    dcg = sum(
        (1.0 / math.log2(rank + 1))
        for rank, is_relevant in enumerate(hits, start=1)
        if is_relevant
    )
    ideal_hits = min(total_relevant, evaluated_k)
    idcg = sum(1.0 / math.log2(rank + 1) for rank in range(1, ideal_hits + 1))
    ndcg = dcg / idcg if idcg else 0.0

    return {
        "precision": precision,
        "recall": recall,
        "map": average_precision,
        "ndcg": ndcg,
        "evaluated_k": evaluated_k,
        "hits": hit_count,
        "relevant_in_pool": total_relevant,
    }


def load_cases(index_path):
    connection = sqlite3.connect(str(index_path))
    connection.row_factory = sqlite3.Row
    try:
        rows = connection.execute(
            """
            SELECT case_id, retrieval_class, label_vector, region_vector, report_text
            FROM historical_cases
            ORDER BY case_id
            """
        ).fetchall()
    finally:
        connection.close()

    cases = []
    skipped = 0
    for row in rows:
        try:
            retrieval_class = row["retrieval_class"]
            if retrieval_class not in CLASSES:
                skipped += 1
                continue
            label_vector = json.loads(row["label_vector"])
            region_vector = json.loads(row["region_vector"])
            if not label_vector or not region_vector:
                raise ValueError("empty vector")
            states = weak_label_states(row["report_text"])
            cases.append(
                {
                    "case_id": row["case_id"],
                    "retrieval_class": retrieval_class,
                    "label_vector": label_vector,
                    "region_vector": region_vector,
                    "states": states,
                }
            )
        except (TypeError, ValueError, json.JSONDecodeError):
            skipped += 1
    return cases, skipped


def case_score(query, candidate, method):
    label_similarity = dot_product(
        query["label_vector"], candidate["label_vector"]
    )
    region_similarity = dot_product(
        query["region_vector"], candidate["region_vector"]
    )
    if method == "combined":
        return LABEL_WEIGHT * label_similarity + REGION_WEIGHT * region_similarity
    if method == "label_only":
        return label_similarity
    if method == "region_only":
        return region_similarity
    raise ValueError("Unknown ranking method: " + method)


def evaluate_class(cases, disease, ks):
    class_cases = [
        case for case in cases if case["retrieval_class"] == disease
    ]
    positive_cases = [
        case for case in cases if case["states"][disease] == "positive"
    ]
    aligned_queries = [
        case for case in positive_cases if case["retrieval_class"] == disease
    ]
    alignment_rate = (
        len(aligned_queries) / len(positive_cases) if positive_cases else None
    )

    # Only cases with explicit positive or explicit negative report mentions
    # are judged. Unknown/unmentioned cases are unjudged and excluded.
    judged_candidates = [
        case
        for case in class_cases
        if case["states"][disease] in ("positive", "negative")
    ]

    method_names = ("combined", "label_only", "region_only")
    per_query_rows = []
    aggregate = {
        method: {
            k: defaultdict(list)
            for k in ks
        }
        for method in method_names
    }
    baseline_precision = {k: [] for k in ks}
    eligible_queries = 0
    no_relevant_neighbor = 0

    for query in aligned_queries:
        candidates = [
            candidate
            for candidate in judged_candidates
            if candidate["case_id"] != query["case_id"]
        ]
        if not candidates:
            no_relevant_neighbor += 1
            continue

        relevant_count = sum(
            1
            for candidate in candidates
            if candidate["states"][disease] == "positive"
        )
        if relevant_count == 0:
            no_relevant_neighbor += 1
            continue

        eligible_queries += 1
        query_row = {
            "disease": disease,
            "query_case_id": query["case_id"],
            "judged_candidate_count": len(candidates),
            "relevant_candidate_count": relevant_count,
        }

        candidate_prevalence = relevant_count / len(candidates)
        for k in ks:
            baseline_precision[k].append(candidate_prevalence)

        for method in method_names:
            ranked = sorted(
                candidates,
                key=lambda candidate: (
                    -case_score(query, candidate, method),
                    candidate["case_id"],
                ),
            )
            relevance = [
                candidate["states"][disease] == "positive"
                for candidate in ranked
            ]
            for k in ks:
                metrics = ranking_metrics(relevance, k)
                for metric_name in ("precision", "recall", "map", "ndcg"):
                    aggregate[method][k][metric_name].append(
                        metrics[metric_name]
                    )
                query_row["{}_p@{}".format(method, k)] = metrics["precision"]
                query_row["{}_r@{}".format(method, k)] = metrics["recall"]
                query_row["{}_map@{}".format(method, k)] = metrics["map"]
                query_row["{}_ndcg@{}".format(method, k)] = metrics["ndcg"]

        per_query_rows.append(query_row)

    summary = {
        "disease": disease,
        "indexed_cases_in_class": len(class_cases),
        "report_positive_cases_all_classes": len(positive_cases),
        "model_class_aligned_positive_cases": len(aligned_queries),
        "model_class_alignment_rate": alignment_rate,
        "judged_candidates_in_class": len(judged_candidates),
        "eligible_leave_one_out_queries": eligible_queries,
        "positive_queries_without_another_judged_positive": no_relevant_neighbor,
        "methods": {},
    }

    for method in method_names:
        summary["methods"][method] = {}
        for k in ks:
            metrics = aggregate[method][k]
            summary["methods"][method]["@{}".format(k)] = {
                name: (sum(values) / len(values) if values else None)
                for name, values in metrics.items()
            }

    summary["random_baseline"] = {
        "@{}".format(k): (
            sum(values) / len(values) if values else None
        )
        for k, values in baseline_precision.items()
    }
    return summary, per_query_rows


def write_csv(path, rows):
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    fieldnames = []
    seen = set()
    for row in rows:
        for key in row:
            if key not in seen:
                seen.add(key)
                fieldnames.append(key)
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(
        description="Run leave-one-out, report-weak-label evaluation of the IU retrieval index."
    )
    parser.add_argument("--index-path", type=Path, default=DEFAULT_INDEX)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--ks",
        type=int,
        nargs="+",
        default=list(DEFAULT_KS),
        help="Ranking cutoffs to report (default: 1 3 5 10).",
    )
    args = parser.parse_args()

    index_path = args.index_path.expanduser().resolve()
    output_dir = args.output_dir.expanduser().resolve()
    if not index_path.is_file():
        raise FileNotFoundError("IU retrieval index not found: {}".format(index_path))
    if not args.ks or any(k < 1 for k in args.ks):
        parser.error("--ks values must be positive integers.")
    ks = tuple(sorted(set(args.ks)))

    cases, skipped = load_cases(index_path)
    if not cases:
        raise RuntimeError("No valid cases/vectors were found in the retrieval index.")

    summaries = []
    query_rows = []
    for disease in CLASSES:
        summary, rows = evaluate_class(cases, disease, ks)
        summaries.append(summary)
        query_rows.extend(rows)

    total_labeled = sum(
        1
        for case in cases
        if any(state != "unknown" for state in case["states"].values())
    )
    report = {
        "evaluation": "leave-one-case-out retrieval with report-derived weak labels",
        "dataset": "Indiana University Chest X-ray (Open-i)",
        "index_path": str(index_path),
        "indexed_cases_loaded": len(cases),
        "rows_skipped": skipped,
        "cases_with_at_least_one_explicit_report_label": total_labeled,
        "ranking": {
            "combined_label_weight": LABEL_WEIGHT,
            "combined_region_weight": REGION_WEIGHT,
            "methods": ["combined", "label_only", "region_only"],
            "candidate_filter": "same model-assigned retrieval_class",
            "query_exclusion": "query case_id excluded from its own candidate list",
            "cutoffs": list(ks),
        },
        "relevance_judgments": (
            "Weak labels are derived from explicit matches in MeSH/Problems and "
            "positive or explicitly negated mentions in Findings/Impression. "
            "Unmentioned disease classes are unjudged, not assumed negative. "
            "Evaluation is restricted to report-judged candidates."
        ),
        "limitations": [
            "MeSH/Problems and report-language matching are weak labels, not expert-adjudicated relevance judgments.",
            "The query and candidates come from the same indexed collection; this is leave-one-case-out, not external validation.",
            "Patient-level separation cannot be guaranteed because the current index schema does not store patient identifiers.",
            "Model-class alignment restricts which report-positive cases can act as queries; alignment rates are reported separately.",
            "The region descriptor is a coarse Grad-CAM coordinate/quadrant descriptor, not lung segmentation.",
            "The ranking score is not a probability or clinical confidence measure.",
        ],
        "per_disease": summaries,
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    summary_path = output_dir / "iu_retrieval_eval_summary.json"
    class_csv = output_dir / "iu_retrieval_eval_by_class.csv"
    query_csv = output_dir / "iu_retrieval_eval_queries.csv"
    summary_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    class_rows = []
    for item in summaries:
        row = {
            key: value
            for key, value in item.items()
            if key not in ("methods", "random_baseline")
        }
        for method, values in item["methods"].items():
            for cutoff, metrics in values.items():
                for metric, value in metrics.items():
                    row["{}_{}{}".format(method, metric, cutoff)] = value
        for cutoff, value in item["random_baseline"].items():
            row["random_precision{}".format(cutoff)] = value
        class_rows.append(row)

    write_csv(class_csv, class_rows)
    write_csv(query_csv, query_rows)

    print("RadSyncc IU historical retrieval evaluation")
    print("==========================================")
    print("Index cases loaded: {}".format(len(cases)))
    print("Cases with at least one explicit report label: {}".format(total_labeled))
    print("Rows skipped: {}".format(skipped))
    print("Judged relevance is based on weak report labels, not clinical adjudication.")
    print()
    for item in summaries:
        print(
            "{} | positive reports={} | class-aligned queries={} | "
            "alignment={} | evaluated queries={}".format(
                item["disease"],
                item["report_positive_cases_all_classes"],
                item["model_class_aligned_positive_cases"],
                (
                    "{:.1%}".format(item["model_class_alignment_rate"])
                    if item["model_class_alignment_rate"] is not None
                    else "n/a"
                ),
                item["eligible_leave_one_out_queries"],
            )
        )
        for k in ks:
            combined = item["methods"]["combined"]["@{}".format(k)]
            baseline = item["random_baseline"]["@{}".format(k)]
            p_at_k = combined["precision"] if combined else None
            print(
                "  P@{} combined={} | random baseline={}".format(
                    k,
                    "{:.3f}".format(p_at_k) if p_at_k is not None else "n/a",
                    "{:.3f}".format(baseline) if baseline is not None else "n/a",
                )
            )

    print()
    print("Wrote:")
    print(summary_path)
    print(class_csv)
    print(query_csv)


if __name__ == "__main__":
    main()

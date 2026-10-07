from pathlib import Path
import sys
import pandas as pd
import requests


PROJECT_ROOT = Path(__file__).resolve().parent.parent

TEST_SET = (
    PROJECT_ROOT
    / "ml"
    / "evaluation"
    / "manual_test_set.csv"
)

API_URL = "http://127.0.0.1:8000/predict"

THRESHOLDS = {
    "Atelectasis": 0.6655,
    "Effusion": 0.6743,
    "Infiltration": 0.5527,
    "Mass": 0.7871,
    "Nodule": 0.8555,
}


df = pd.read_csv(TEST_SET)

print("=" * 80)
print("THORAXAI — 20 IMAGE API SANITY TEST")
print("=" * 80)
print(f"Images to test: {len(df)}")
print()


results = []

for index, row in df.iterrows():

    image_name = row["Image Index"]
    ground_truth = row["Ground Truth"].split("|")

    # Find image inside D:\archive
    image_path = next(
        Path(r"D:\archive").glob(
            f"images_*/images/{image_name}"
        ),
        None,
    )

    if image_path is None:
        print(f"[ERROR] Image not found: {image_name}")
        continue

    print(
        f"[{index + 1:02d}/20] "
        f"{image_name}"
    )

    try:

        with open(image_path, "rb") as image_file:

            response = requests.post(
                API_URL,
                files={
                    "file": (
                        image_name,
                        image_file,
                        "image/png",
                    )
                },
                timeout=120,
            )

        response.raise_for_status()

        data = response.json()

        predictions = data["predictions"]

        detected = [
            disease
            for disease, probability in predictions.items()
            if probability >= THRESHOLDS[disease]
        ]

        correct_detected = [
            disease
            for disease in ground_truth
            if disease in detected
        ]

        missed = [
            disease
            for disease in ground_truth
            if disease not in detected
        ]

        false_positive = [
            disease
            for disease in detected
            if disease not in ground_truth
        ]

        results.append({
            "Image": image_name,
            "Ground Truth": "|".join(ground_truth),
            "Detected": "|".join(detected),
            "Correct": "|".join(correct_detected),
            "Missed": "|".join(missed),
            "False Positive": "|".join(false_positive),
            **predictions,
        })

        print(
            f"    Ground truth : {ground_truth}"
        )

        print(
            f"    Detected     : "
            f"{detected if detected else 'None'}"
        )

        print(
            f"    Probabilities: "
            f"A={predictions['Atelectasis']:.3f} "
            f"E={predictions['Effusion']:.3f} "
            f"I={predictions['Infiltration']:.3f} "
            f"M={predictions['Mass']:.3f} "
            f"N={predictions['Nodule']:.3f}"
        )

    except Exception as exc:

        print(
            f"    ERROR: {exc}"
        )

    print()


# ============================================================
# SUMMARY
# ============================================================

result_df = pd.DataFrame(results)

output_path = (
    PROJECT_ROOT
    / "ml"
    / "evaluation"
    / "api_sanity_results.csv"
)

result_df.to_csv(
    output_path,
    index=False,
)


print("=" * 80)
print("SANITY TEST SUMMARY")
print("=" * 80)

total = len(result_df)

total_correct = 0
total_missed = 0
total_false_positive = 0

for _, row in result_df.iterrows():

    ground_truth = set(
        row["Ground Truth"].split("|")
    )

    detected = (
        set(row["Detected"].split("|"))
        if row["Detected"]
        else set()
    )

    total_correct += len(
        ground_truth & detected
    )

    total_missed += len(
        ground_truth - detected
    )

    total_false_positive += len(
        detected - ground_truth
    )


print(f"Images tested          : {total}")
print(f"Correct disease hits   : {total_correct}")
print(f"Missed diseases        : {total_missed}")
print(f"False positive diseases: {total_false_positive}")

print()
print(f"Results saved to:")
print(output_path)

print("=" * 80)
from pathlib import Path
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent

TEST_CSV = PROJECT_ROOT / "data" / "splits" / "test.csv"
OUTPUT = PROJECT_ROOT / "ml" / "evaluation" / "manual_test_set.csv"

CLASSES = [
    "Atelectasis",
    "Effusion",
    "Infiltration",
    "Mass",
    "Nodule",
]

df = pd.read_csv(TEST_CSV)

# Keep track of images we've already selected
selected_images = set()

rows = []

# Select 4 examples for each disease.
# Prefer examples where that disease is the only target disease,
# because they are easier to interpret manually.
for disease in CLASSES:

    # First preference: disease is present and no other target disease
    candidates = df[
        (df[disease] == 1)
        &
        (df[CLASSES].sum(axis=1) == 1)
    ]

    # If there aren't enough, use any image containing the disease
    if len(candidates) < 4:
        candidates = df[df[disease] == 1]

    count = 0

    for _, row in candidates.iterrows():

        image_name = row["Image Index"]

        if image_name in selected_images:
            continue

        selected_images.add(image_name)

        labels = [
            c for c in CLASSES
            if row[c] == 1
        ]

        rows.append({
            "Image Index": image_name,
            "Target Disease": disease,
            "Ground Truth": "|".join(labels),
        })

        count += 1

        if count == 4:
            break


result = pd.DataFrame(rows)

OUTPUT.parent.mkdir(
    parents=True,
    exist_ok=True,
)

result.to_csv(
    OUTPUT,
    index=False,
)

print("=" * 60)
print("MANUAL TEST SET")
print("=" * 60)

print(f"Total images: {len(result)}")
print()

for disease in CLASSES:
    subset = result[
        result["Target Disease"] == disease
    ]

    print(f"\n{disease}")

    for _, row in subset.iterrows():
        print(
            f"  {row['Image Index']:20s}"
            f" Ground truth: {row['Ground Truth']}"
        )

print()
print(f"Saved to:")
print(OUTPUT)
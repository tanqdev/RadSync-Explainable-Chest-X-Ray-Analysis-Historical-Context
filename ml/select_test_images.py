from pathlib import Path
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent

TEST_CSV = PROJECT_ROOT / "data" / "splits" / "test.csv"

CLASSES = [
    "Atelectasis",
    "Effusion",
    "Infiltration",
    "Mass",
    "Nodule",
]

df = pd.read_csv(TEST_CSV)

print(f"Test images: {len(df):,}")
print()

for disease in CLASSES:

    matches = df[df[disease] == 1]

    if len(matches) == 0:
        print(f"{disease}: no examples found")
        continue

    # Take the first positive example
    row = matches.iloc[0]

    print(f"{disease}")
    print(f"  Image: {row['Image Index']}")
    print(f"  Ground truth labels:")

    labels = [
        c for c in CLASSES
        if row[c] == 1
    ]

    print(f"  {labels}")
    print()
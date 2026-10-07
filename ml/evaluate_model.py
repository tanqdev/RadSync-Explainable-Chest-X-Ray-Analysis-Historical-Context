import os
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import models, transforms

from sklearn.metrics import (
    roc_auc_score,
    f1_score,
    precision_recall_curve,
)


# ============================================================
# CONFIG
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

DATA_ROOT = Path(r"D:\archive")

VAL_CSV = PROJECT_ROOT / "data" / "splits" / "validation.csv"
TEST_CSV = PROJECT_ROOT / "data" / "splits" / "test.csv"

MODEL_PATH = PROJECT_ROOT / "models" / "densenet121_best.pth"

OUTPUT_DIR = PROJECT_ROOT / "ml" / "evaluation"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

CLASSES = [
    "Atelectasis",
    "Effusion",
    "Infiltration",
    "Mass",
    "Nodule",
]

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

BATCH_SIZE = 64


# ============================================================
# TRANSFORM
# Same preprocessing used during validation/testing
# ============================================================

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


# ============================================================
# BUILD IMAGE INDEX
# ============================================================

print("Building image index...")

image_index = {}

for folder in sorted(DATA_ROOT.glob("images_*")):
    image_dir = folder / "images"

    if not image_dir.exists():
        continue

    for image_path in image_dir.glob("*.png"):
        image_index[image_path.name] = image_path

print(f"Indexed {len(image_index):,} images.")


# ============================================================
# DATASET
# ============================================================

class ChestXrayDataset(Dataset):

    def __init__(self, dataframe):
        self.df = dataframe.reset_index(drop=True)

    def __len__(self):
        return len(self.df)

    def __getitem__(self, index):

        row = self.df.iloc[index]

        image_name = row["Image Index"]
        image_path = image_index.get(image_name)

        if image_path is None:
            raise FileNotFoundError(
                f"Image not found: {image_name}"
            )

        image = Image.open(image_path).convert("RGB")

        image = transform(image)

        labels = torch.tensor(
            row[CLASSES].values.astype(np.float32)
        )

        return image, labels


# ============================================================
# LOAD MODEL
# ============================================================

print()
print("Loading model...")
print(f"Model: {MODEL_PATH}")
print(f"Device: {DEVICE}")

model = models.densenet121(weights=None)

model.classifier = nn.Linear(
    model.classifier.in_features,
    len(CLASSES),
)

checkpoint = torch.load(
    MODEL_PATH,
    map_location=DEVICE,
    weights_only=False,
)

model.load_state_dict(
    checkpoint["model_state_dict"]
)

model.to(DEVICE)
model.eval()

print("Model loaded successfully.")


# ============================================================
# PREDICTION FUNCTION
# ============================================================

def get_predictions(csv_path):

    df = pd.read_csv(csv_path)

    dataset = ChestXrayDataset(df)

    loader = DataLoader(
        dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=0,
        pin_memory=torch.cuda.is_available(),
    )

    all_labels = []
    all_probabilities = []

    print()
    print(f"Running inference on {len(dataset):,} images...")

    with torch.no_grad():

        for batch_idx, (images, labels) in enumerate(loader):

            images = images.to(
                DEVICE,
                non_blocking=True,
            )

            with torch.autocast(
                device_type="cuda",
                dtype=torch.float16,
                enabled=DEVICE.type == "cuda",
            ):

                logits = model(images)

            probabilities = torch.sigmoid(logits)

            all_labels.append(
                labels.numpy()
            )

            all_probabilities.append(
                probabilities.cpu().numpy()
            )

            if (batch_idx + 1) % 100 == 0:
                print(
                    f"Batch {batch_idx + 1}/{len(loader)}"
                )

    y_true = np.concatenate(
        all_labels,
        axis=0,
    )

    y_prob = np.concatenate(
        all_probabilities,
        axis=0,
    )

    return y_true, y_prob


# ============================================================
# VALIDATION INFERENCE
# ============================================================

print()
print("=" * 60)
print("VALIDATION SET")
print("=" * 60)

val_true, val_prob = get_predictions(VAL_CSV)


# Save validation predictions
np.savez(
    OUTPUT_DIR / "validation_predictions.npz",
    y_true=val_true,
    y_prob=val_prob,
)

print("Validation predictions saved.")


# ============================================================
# VALIDATION AUC
# ============================================================

print()
print("Validation ROC-AUC:")

val_auc_scores = []

for i, disease in enumerate(CLASSES):

    auc = roc_auc_score(
        val_true[:, i],
        val_prob[:, i],
    )

    val_auc_scores.append(auc)

    print(
        f"{disease:15s}: {auc:.4f}"
    )

macro_auc = np.mean(val_auc_scores)

print(
    f"\nMacro ROC-AUC : {macro_auc:.4f}"
)


# ============================================================
# FIND BEST THRESHOLD FOR EACH DISEASE
# ============================================================

print()
print("=" * 60)
print("THRESHOLD TUNING")
print("=" * 60)

thresholds = {}

for i, disease in enumerate(CLASSES):

    precision, recall, threshold_values = (
        precision_recall_curve(
            val_true[:, i],
            val_prob[:, i],
        )
    )

    # Avoid division by zero
    f1_scores = (
        2 * precision[:-1] * recall[:-1]
        / (
            precision[:-1]
            + recall[:-1]
            + 1e-8
        )
    )

    best_index = np.argmax(f1_scores)

    best_threshold = threshold_values[best_index]
    best_f1 = f1_scores[best_index]

    thresholds[disease] = float(best_threshold)

    print(
        f"{disease:15s} "
        f"threshold={best_threshold:.4f} "
        f"F1={best_f1:.4f}"
    )


# Save thresholds
threshold_df = pd.DataFrame({
    "Disease": list(thresholds.keys()),
    "Threshold": list(thresholds.values()),
})

threshold_df.to_csv(
    OUTPUT_DIR / "thresholds.csv",
    index=False,
)

print()
print(
    f"Saved thresholds to: "
    f"{OUTPUT_DIR / 'thresholds.csv'}"
)


# ============================================================
# VALIDATION F1 USING TUNED THRESHOLDS
# ============================================================

val_predictions = np.zeros_like(
    val_prob,
    dtype=np.int8
)

for i, disease in enumerate(CLASSES):

    threshold = thresholds[disease]

    val_predictions[:, i] = (
        val_prob[:, i] >= threshold
    ).astype(int)


print()
print("Validation F1 using tuned thresholds:")

for i, disease in enumerate(CLASSES):

    f1 = f1_score(
        val_true[:, i],
        val_predictions[:, i],
        zero_division=0,
    )

    print(
        f"{disease:15s}: {f1:.4f}"
    )

macro_f1 = f1_score(
    val_true,
    val_predictions,
    average="macro",
    zero_division=0,
)

print(
    f"\nMacro F1: {macro_f1:.4f}"
)


# ============================================================
# TEST SET
# IMPORTANT:
# We only evaluate here AFTER thresholds are fixed.
# ============================================================

print()
print("=" * 60)
print("FINAL TEST SET EVALUATION")
print("=" * 60)

test_true, test_prob = get_predictions(TEST_CSV)


# Save test predictions
np.savez(
    OUTPUT_DIR / "test_predictions.npz",
    y_true=test_true,
    y_prob=test_prob,
)

print("Test predictions saved.")


# ============================================================
# TEST ROC-AUC
# ============================================================

test_auc_scores = []

print()
print("Test ROC-AUC:")

for i, disease in enumerate(CLASSES):

    auc = roc_auc_score(
        test_true[:, i],
        test_prob[:, i],
    )

    test_auc_scores.append(auc)

    print(
        f"{disease:15s}: {auc:.4f}"
    )

test_macro_auc = np.mean(test_auc_scores)

print(
    f"\nTest Macro ROC-AUC: "
    f"{test_macro_auc:.4f}"
)


# ============================================================
# TEST CLASSIFICATION USING VALIDATION THRESHOLDS
# ============================================================

test_predictions = np.zeros_like(
    test_prob,
    dtype=np.int8
)

for i, disease in enumerate(CLASSES):

    threshold = thresholds[disease]

    test_predictions[:, i] = (
        test_prob[:, i] >= threshold
    ).astype(int)


# ============================================================
# TEST F1
# ============================================================

print()
print("Test F1:")

test_f1_scores = []

for i, disease in enumerate(CLASSES):

    f1 = f1_score(
        test_true[:, i],
        test_predictions[:, i],
        zero_division=0,
    )

    test_f1_scores.append(f1)

    print(
        f"{disease:15s}: {f1:.4f}"
    )

test_macro_f1 = np.mean(test_f1_scores)

print(
    f"\nTest Macro F1: "
    f"{test_macro_f1:.4f}"
)


# ============================================================
# FINAL SUMMARY
# ============================================================

print()
print("=" * 60)
print("FINAL MODEL EVALUATION")
print("=" * 60)

print(f"Model             : DenseNet121 Epoch 4")
print(f"Validation AUC    : {macro_auc:.4f}")
print(f"Validation F1     : {macro_f1:.4f}")
print(f"Test Macro AUC    : {test_macro_auc:.4f}")
print(f"Test Macro F1     : {test_macro_f1:.4f}")

print()
print("Thresholds:")

for disease, threshold in thresholds.items():
    print(
        f"{disease:15s}: {threshold:.4f}"
    )

print("=" * 60)
import os

import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image


# The five diseases our model was trained to predict
CLASSES = [
    "Atelectasis",
    "Effusion",
    "Infiltration",
    "Mass",
    "Nodule",
]


# Select GPU if available, otherwise CPU
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# Project root:
# Server/services/predictor.py
#       ↑
# parents[0] = services
# parents[1] = Server
# parents[2] = Chest-XRay-Project
PROJECT_ROOT = os.path.dirname(
    os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))
    )
)

MODEL_PATH = os.path.join(
    PROJECT_ROOT,
    "models",
    "densenet121_best.pth",
)


# Same preprocessing used during validation/testing
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


def load_model():
    print(f"Loading model from: {MODEL_PATH}")
    print(f"Using device: {DEVICE}")

    # Create the same DenseNet121 architecture
    model = models.densenet121(weights=None)

    # Replace the original classifier with our 5-class classifier
    model.classifier = nn.Linear(
        model.classifier.in_features,
        len(CLASSES),
    )

    # Load our trained checkpoint
    checkpoint = torch.load(
        MODEL_PATH,
        map_location=DEVICE,
        weights_only=False,
    )

    model.load_state_dict(checkpoint["model_state_dict"])

    model.to(DEVICE)
    model.eval()

    print("Model loaded successfully.")

    return model


# Load model ONCE when this module is imported
model = load_model()


def predict_image(image: Image.Image):
    """
    Run inference on a chest X-ray image.

    Returns:
        Dictionary containing probability for each disease.
    """

    # Convert image to RGB
    image = image.convert("RGB")

    # Apply preprocessing
    tensor = transform(image)

    # Add batch dimension:
    # [3, 224, 224] -> [1, 3, 224, 224]
    tensor = tensor.unsqueeze(0)

    # Move image to same device as model
    tensor = tensor.to(DEVICE)

    # No gradients needed during inference
    with torch.no_grad():
        logits = model(tensor)

        # Convert logits to probabilities
        probabilities = torch.sigmoid(logits)

    probabilities = probabilities[0].cpu().tolist()

    results = {}

    for disease, probability in zip(CLASSES, probabilities):
        results[disease] = round(probability, 4)

    return results
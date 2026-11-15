import base64
import os
from io import BytesIO

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from pytorch_grad_cam.utils.image import show_cam_on_image

CLASSES = ["Atelectasis", "Effusion", "Infiltration", "Mass", "Nodule"]
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_PATH = os.path.join(PROJECT_ROOT, "models", "densenet121_best.pth")

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def load_model():
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model checkpoint not found: {MODEL_PATH}")
    print(f"Loading model from: {MODEL_PATH}")
    print(f"Using device: {DEVICE}")
    network = models.densenet121(weights=None)
    network.classifier = nn.Linear(network.classifier.in_features, len(CLASSES))
    checkpoint = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=False)
    state_dict = checkpoint.get("model_state_dict", checkpoint)
    network.load_state_dict(state_dict)
    network.to(DEVICE)
    network.eval()
    print("DenseNet121 loaded successfully.")
    return network


model = load_model()


def prepare_image(image: Image.Image):
    rgb = image.convert("RGB").resize((224, 224))
    tensor = transform(rgb).unsqueeze(0).to(DEVICE)
    rgb_array = np.asarray(rgb, dtype=np.float32) / 255.0
    return rgb, tensor, rgb_array


def predict_image(image: Image.Image):
    _, tensor, _ = prepare_image(image)
    with torch.inference_mode():
        logits = model(tensor)
        probabilities = torch.sigmoid(logits)[0].cpu().tolist()
    return {disease: round(float(probability), 4) for disease, probability in zip(CLASSES, probabilities)}


def explain_image(image: Image.Image, disease: str):
    if disease not in CLASSES:
        raise ValueError(f"Unsupported disease. Choose one of: {', '.join(CLASSES)}")

    _, tensor, rgb_array = prepare_image(image)
    target_index = CLASSES.index(disease)
    target_layers = [model.features.denseblock4]

    # Grad-CAM requires gradients, so do not wrap this block in inference_mode/no_grad.
    with GradCAM(model=model, target_layers=target_layers) as cam:
        grayscale_cam = cam(
            input_tensor=tensor,
            targets=[ClassifierOutputTarget(target_index)],
        )[0]

    overlay = show_cam_on_image(rgb_array, grayscale_cam, use_rgb=True)
    output = BytesIO()
    Image.fromarray(overlay).save(output, format="PNG")
    encoded = base64.b64encode(output.getvalue()).decode("ascii")
    return {
        "disease": disease,
        "heatmap": f"data:image/png;base64,{encoded}",
    }

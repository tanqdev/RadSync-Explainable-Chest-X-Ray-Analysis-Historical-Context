import os
from io import BytesIO

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

from Server.services.predictor import CLASSES, DEVICE, explain_image, predict_image

app = FastAPI(
    title="RadSyn API",
    description="DenseNet121 chest X-ray classification and Grad-CAM explanation API",
    version="1.1.0",
)

origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
)


def decode_image(contents: bytes) -> Image.Image:
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be 10 MB or smaller.")
    try:
        image = Image.open(BytesIO(contents))
        image.load()
        return image
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid PNG or JPEG image.")


@app.get("/health")
def health():
    return {"status": "ok", "service": "RadSyn API", "model": "DenseNet121", "device": str(DEVICE)}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")
    if file.content_type not in {"image/png", "image/jpeg", "image/jpg"}:
        raise HTTPException(status_code=400, detail="Only PNG and JPEG images are supported.")
    image = decode_image(await file.read())
    try:
        return {"filename": file.filename, "predictions": predict_image(image)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc


@app.post("/gradcam")
async def gradcam(file: UploadFile = File(...), disease: str = Form(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")
    if file.content_type not in {"image/png", "image/jpeg", "image/jpg"}:
        raise HTTPException(status_code=400, detail="Only PNG and JPEG images are supported.")
    if disease not in CLASSES:
        raise HTTPException(status_code=422, detail=f"Disease must be one of: {', '.join(CLASSES)}")
    image = decode_image(await file.read())
    try:
        return explain_image(image, disease)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Grad-CAM generation failed: {exc}") from exc

from io import BytesIO

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from Server.services.predictor import predict_image


app = FastAPI(
    title="ThoraxAI API",
    description="Chest X-ray analysis backend",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ThoraxAI API",
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    # Make sure a file was actually uploaded
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file provided",
        )

    # Only accept common image formats
    allowed_types = {
        "image/png",
        "image/jpeg",
        "image/jpg",
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only PNG and JPEG images are supported",
        )

    try:
        # Read uploaded file into memory
        contents = await file.read()

        # Open image using PIL
        image = Image.open(BytesIO(contents))

        # Run our trained DenseNet121 model
        predictions = predict_image(image)

        return {
            "filename": file.filename,
            "predictions": predictions,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(exc)}",
        )
import json
import os
from io import BytesIO
from typing import Any

from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

from Server.services.predictor import CLASSES, DEVICE, explain_image, predict_image
from Server.services.retrieval import retrieve_similar_cases

app = FastAPI(
    title="RadSyn API",
    description="DenseNet121 chest X-ray classification, Grad-CAM, and historical case retrieval API",
    version="1.2.0",
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


def validate_upload(file: UploadFile):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")
    if file.content_type not in {"image/png", "image/jpeg", "image/jpg"}:
        raise HTTPException(status_code=400, detail="Only PNG and JPEG images are supported.")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "RadSyn API",
        "model": "DenseNet121",
        "device": str(DEVICE),
        "retrieval_index": os.path.exists(os.getenv("RADSYN_MIMIC_INDEX", "data/mimic_index.sqlite")),
        "llm_configured": bool(os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_MODEL")),
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    validate_upload(file)
    image = decode_image(await file.read())
    try:
        return {"filename": file.filename, "predictions": predict_image(image)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc


@app.post("/gradcam")
async def gradcam(file: UploadFile = File(...), disease: str = Form(...)):
    validate_upload(file)
    if disease not in CLASSES:
        raise HTTPException(status_code=422, detail=f"Disease must be one of: {', '.join(CLASSES)}")
    image = decode_image(await file.read())
    try:
        return explain_image(image, disease)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Grad-CAM generation failed: {exc}") from exc


@app.post("/retrieve")
async def retrieve(file: UploadFile = File(...), top_k: int = Form(5)):
    validate_upload(file)
    if not 1 <= top_k <= 10:
        raise HTTPException(status_code=422, detail="top_k must be between 1 and 10.")
    image = decode_image(await file.read())
    try:
        return retrieve_similar_cases(image, top_k=top_k)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Historical retrieval failed: {exc}") from exc


class RetrievedCaseInput(BaseModel):
    id: str = Field(max_length=128)
    similarity: float = Field(ge=0, le=100)
    finding: str = Field(max_length=128)
    report: str = Field(max_length=12000)


class SummaryRequest(BaseModel):
    predictions: dict[str, float]
    cases: list[RetrievedCaseInput] = Field(default_factory=list, max_length=5)


@app.post("/summarize")
def summarize(payload: SummaryRequest = Body(...)):
    api_key = os.getenv("OPENAI_API_KEY")
    model_name = os.getenv("OPENAI_MODEL")
    if not api_key or not model_name:
        raise HTTPException(
            status_code=503,
            detail="LLM summary is not configured. Set OPENAI_API_KEY and OPENAI_MODEL on the backend.",
        )
    if not payload.cases:
        raise HTTPException(status_code=422, detail="At least one retrieved historical report is required.")

    grounded_cases: list[dict[str, Any]] = [
        {
            "case_id": case.id,
            "similarity_percent": case.similarity,
            "retrieval_class": case.finding,
            "report_text": case.report,
        }
        for case in payload.cases
    ]
    prompt_data = {
        "current_model_probabilities_percent": payload.predictions,
        "retrieved_deidentified_historical_cases": grounded_cases,
    }
    instructions = (
        "You are writing a concise research-support comparison for a chest X-ray AI prototype. "
        "Use only the supplied model probability values and historical report text. "
        "Describe similarities and differences as reported observations, and cite historical records using their case IDs. "
        "Do not diagnose the current image, infer missing findings, recommend treatment, or claim clinical certainty. "
        "State explicitly that historical reports are context only and the summary is not a medical diagnosis. "
        "If the available reports do not support a comparison, say so plainly."
    )
    try:
        client = OpenAI(api_key=api_key)
        response = client.responses.create(
            model=model_name,
            instructions=instructions,
            input=json.dumps(prompt_data, ensure_ascii=False),
            max_output_tokens=450,
        )
        return {"summary": response.output_text, "model": model_name, "case_ids": [case.id for case in payload.cases]}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM summary request failed: {exc}") from exc

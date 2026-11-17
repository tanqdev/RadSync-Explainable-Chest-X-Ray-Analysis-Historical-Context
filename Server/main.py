import json
import os
from io import BytesIO
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from PIL import Image, UnidentifiedImageError
from pydantic import AliasChoices, BaseModel, Field

# Load local secrets before importing application modules that read environment settings.
load_dotenv(Path(__file__).resolve().with_name(".env"), override=False)

from Server.services.predictor import CLASSES, DEVICE, explain_image, predict_image
from Server.services.retrieval import get_dataset_label, get_index_path, retrieve_similar_cases

app = FastAPI(
    title="RadSync API",
    description="DenseNet121 chest X-ray classification, Grad-CAM, and historical case retrieval API",
    version="1.3.0",
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
        "service": "RadSync API",
        "model": "DenseNet121",
        "device": str(DEVICE),
        "retrieval_index": get_index_path().is_file(),
        "retrieval_source": get_dataset_label(),
        "retrieval_index_path": str(get_index_path()),
        "llm_configured": bool(os.getenv("GEMINI_API_KEY") and os.getenv("GEMINI_MODEL")),
        "llm_provider": "Google Gemini",
        "llm_model": os.getenv("GEMINI_MODEL") if os.getenv("GEMINI_API_KEY") and os.getenv("GEMINI_MODEL") else None,
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
    retrieval_class: str = Field(max_length=128, validation_alias=AliasChoices("retrieval_class", "finding"))
    report: str = Field(max_length=12000)


class SummaryRequest(BaseModel):
    predictions: dict[str, float]
    cases: list[RetrievedCaseInput] = Field(default_factory=list, max_length=5)


def compact_report_for_summary(report: str) -> str:
    """Keep the clinically relevant source sections while bounding LLM input size."""
    limits = {
        "indication": 240,
        "comparison": 220,
        "findings": 650,
        "impression": 650,
    }
    sections: dict[str, str] = {}
    for block in report.split("\n\n"):
        label, separator, value = block.partition(":")
        key = label.strip().lower()
        if separator and key in limits and value.strip():
            sections[key] = value.strip()[: limits[key]]

    if not sections:
        return report.strip()[:1600]

    return "\n".join(
        f"{label.title()}: {sections[label]}"
        for label in ("indication", "comparison", "findings", "impression")
        if label in sections
    )


@app.post("/summarize")
def summarize(payload: SummaryRequest = Body(...)):
    if not payload.cases:
        raise HTTPException(status_code=422, detail="At least one retrieved historical report is required.")

    # The UI may display five ranked studies, but synthesis only needs the
    # top three. Keep report sections short to avoid oversized prompts and
    # reduce Gemini's probability of returning DEADLINE_EXCEEDED.
    summary_cases = payload.cases[:3]
    grounded_cases: list[dict[str, Any]] = [
        {
            "case_id": case.id,
            "similarity_percent": case.similarity,
            "retrieval_class": case.retrieval_class,
            "report_text": compact_report_for_summary(case.report),
        }
        for case in summary_cases
    ]

    api_key = os.getenv("GEMINI_API_KEY")
    model_name = os.getenv("GEMINI_MODEL")
    if not api_key or not model_name:
        score_lines = [
            f"{name}: {float(score):.1f}%"
            for name, score in sorted(
                payload.predictions.items(),
                key=lambda item: float(item[1]),
                reverse=True,
            )
        ]
        summary_lines = [
            "Local evidence summary (no external LLM configured).",
            "Current model probability outputs (not diagnoses): "
            + "; ".join(score_lines),
            "Retrieved historical report excerpts (context only):",
        ]
        for case in payload.cases:
            report_lines = [
                line.strip()
                for line in case.report.splitlines()
                if line.strip()
            ]
            excerpt = " ".join(report_lines[2:])[:420]
            summary_lines.append(
                f"{case.id} — model-assigned retrieval class: {case.retrieval_class}; "
                f"prototype ranking score: {case.similarity:.1f}/100. "
                f"Source report excerpt: {excerpt or 'No report excerpt available.'}"
            )
        summary_lines.append(
            "These historical records are reference context only. "
            "The classifier outputs and this summary are not a medical diagnosis."
        )
        return {
            "summary": "\n".join(summary_lines),
            "model": "Local evidence summary",
            "case_ids": [case.id for case in payload.cases],
        }

    prompt_data = {
        "current_model_probabilities_percent": payload.predictions,
        "retrieved_deidentified_historical_cases": grounded_cases,
    }
    instructions = (
        "Write a concise research-only synthesis for RadSync, a chest X-ray AI prototype. "
        "Use only the supplied model scores and de-identified historical report excerpts. "
        "Use four brief headings: Model output; Historical report observations; "
        "Supported comparison; Limitations. "
        "Separate current model scores from historical report statements and cite each "
        "historical observation with its case ID. The retrieval category is assigned by "
        "RadSync, not an original radiologist label. Ranking scores are not probabilities. "
        "Never infer missing findings, reconstruct XXX/XXXX redactions, diagnose, or recommend treatment. "
        "If evidence is insufficient, say so. End by stating this is research context, not a diagnosis."
    )
    try:
        # This is a single-turn synthesis task, so use the standard Generate Content
        # API rather than the Interactions API. The explicit timeout prevents a
        # stalled provider request from leaving the browser spinner running forever.
        with genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=180_000),
        ) as client:
            response = client.models.generate_content(
                model=model_name,
                contents=json.dumps(prompt_data, ensure_ascii=False),
                config=types.GenerateContentConfig(
                    system_instruction=instructions,
                    max_output_tokens=850,
                ),
            )
        summary_text = response.text
        if not summary_text or not summary_text.strip():
            raise ValueError("Gemini returned an empty response. Check model availability and safety feedback.")
        return {
            "summary": summary_text.strip(),
            "model": model_name,
            "case_ids": [case.id for case in summary_cases],
        }
    except Exception as exc:
        error_text = str(exc)
        error_lower = error_text.lower()
        provider_code = getattr(exc, "code", None)
        status_code_from_error = getattr(exc, "status_code", None)
        provider_code = provider_code or status_code_from_error

        if provider_code == 504 or "deadline_exceeded" in error_lower:
            status_code = 504
            detail = (
                "Gemini exceeded its generation deadline. RadSync already limits the "
                "request to the three highest-ranked reports. Retry once; if it persists, "
                "change GEMINI_MODEL to gemini-3.5-flash-lite in Server/.env."
            )
        elif provider_code == 429:
            status_code = 503
            detail = "Gemini rate limit or quota reached. Check Google AI Studio API usage and retry shortly."
        elif provider_code in (401, 403):
            status_code = 502
            detail = "Gemini rejected the API key or the key does not have access to this API. Check GEMINI_API_KEY in Server/.env."
        elif provider_code == 404:
            status_code = 502
            detail = f"Gemini model '{model_name}' was not found or is not available to this API key. Check GEMINI_MODEL in Server/.env."
        elif "timeout" in error_lower or "timed out" in error_lower:
            status_code = 504
            detail = "Gemini did not respond within 60 seconds. Check the connection and retry."
        else:
            status_code = 502
            detail = f"Gemini summary request failed: {error_text[:500]}"

        raise HTTPException(status_code=status_code, detail=detail) from exc

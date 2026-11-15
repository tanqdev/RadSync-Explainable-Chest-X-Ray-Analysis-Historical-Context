# RadSyn API

## Run locally (Windows PowerShell)

From the repository root:

```powershell
.\venv\Scripts\Activate.ps1
pip install -r Server\requirements.txt
uvicorn Server.main:app --reload --host 127.0.0.1 --port 8000
```

The trained checkpoint is expected at `models/densenet121_best.pth`.

## Endpoints

- `GET /health` — model, retrieval-index, and optional LLM configuration status.
- `POST /predict` — multipart field `file`; returns five DenseNet121 sigmoid probabilities.
- `POST /gradcam` — multipart fields `file` and `disease`; returns a computed Grad-CAM overlay as a PNG data URL.
- `POST /retrieve` — multipart fields `file` and optional `top_k`; performs uncertainty-triggered historical case retrieval.
- `POST /summarize` — JSON body containing model probabilities and retrieved report excerpts; generates a grounded, non-diagnostic comparison using the configured OpenAI model.

Accepted image uploads: PNG/JPEG, maximum 10 MB.

## Configure MIMIC-CXR retrieval

MIMIC-CXR is not bundled in this repository. Obtain authorized access to MIMIC-CXR / MIMIC-CXR-JPG and its de-identified report text files separately. Keep the dataset outside Git.

The index builder expects:
- A MIMIC metadata CSV containing `subject_id`, `study_id`, and `dicom_id`. If a `path` column exists, it is used for image paths.
- The MIMIC-CXR-JPG directory containing `files/`.
- Matching study report text files at `files/pXX/pSUBJECT/sSTUDY.txt`.

Build a first retrieval index (the default is 1,000 PA/AP images):

```powershell
python -m ml.build_mimic_index --metadata-csv "D:\MIMIC\mimic-cxr-2.0.0-metadata.csv" --image-root "D:\MIMIC"
```

Use `--limit 5000` to index more images. The script computes model probabilities and a Grad-CAM spatial descriptor per indexed image, then writes the local SQLite index to `data/mimic_index.sqlite`. To use a different database path, set `RADSYN_MIMIC_INDEX` before starting FastAPI.

Retrieval is triggered only when at least one disease probability is within `RADSYN_UNCERTAINTY_DELTA` of its validation-selected threshold. Similarity combines normalized disease-score vectors and Grad-CAM region descriptors. The descriptor uses normalized image coordinates; it is not lung-segmentation-aware.

## Configure LLM summaries

Set these backend environment variables before starting FastAPI:

```powershell
$env:OPENAI_API_KEY = "your-api-key"
$env:OPENAI_MODEL = "your-enabled-model"
```

The summary uses only retrieved de-identified reports and current model probability scores. It is explicitly non-diagnostic. Without these variables, retrieval still works but `/summarize` returns HTTP 503.

## Notes

This is a research prototype, not a diagnostic service. The retrieval index contains local image paths and report excerpts; do not commit the MIMIC-CXR dataset, index database, or API keys.

# RadSyn API

## Run locally (Windows CMD)

From the repository root:

```cmd
venv\Scripts\activate.bat
pip install -r Server\requirements.txt
python -m uvicorn Server.main:app --host 127.0.0.1 --port 8000
```

The trained checkpoint is expected at `models/densenet121_best.pth`.

## Endpoints

- `GET /health` — model/device, selected retrieval source, index path and optional LLM configuration.
- `POST /predict` — multipart field `file`; returns five DenseNet121 sigmoid probabilities.
- `POST /gradcam` — multipart fields `file` and `disease`; returns a computed Grad-CAM overlay as a PNG data URL.
- `POST /retrieve` — multipart fields `file` and optional `top_k`; performs uncertainty-triggered historical case retrieval.
- `POST /summarize` — JSON body containing model probabilities and retrieved report excerpts; generates a grounded, non-diagnostic comparison using the configured OpenAI model.

Accepted image uploads: PNG/JPEG, maximum 10 MB.

## Configure Indiana University (Open-i) retrieval

For the current local prototype, RadSyn defaults to the Indiana University Chest X-ray index. The source dataset must remain outside Git. The expected local layout is:

- `D:\archive\indiana_reports.csv`
- `D:\archive\indiana_projections.csv`
- `D:\archive\images\images_normalized\` containing the PNGs

Build a 50-image smoke-test index (frontal views only):

```cmd
python -m ml.build_iu_index --limit 50
```

The builder joins reports and projections by `uid`, includes only Frontal projections, stores report text with source/UID provenance, and writes `data/iu_index.sqlite`. It resumes by skipping case IDs already indexed. Increase the limit after the smoke test, for example:

```cmd
python -m ml.build_iu_index --limit 500
python -m ml.build_iu_index --limit 3818
```

The limit means the maximum number of new frontal images attempted during that run, not a target total. The builder runs the existing NIH-trained DenseNet121 and computes a Grad-CAM region descriptor per indexed image. This can take time; monitor the progress output and GPU utilization. The SQLite index, source images, and report CSVs are local artifacts and must not be committed.

By default the API reads `data/iu_index.sqlite`. Override it with `RADSYN_INDEX_PATH`. `RADSYN_DATASET_NAME` changes the displayed source label. The legacy `RADSYN_MIMIC_INDEX` variable remains supported if you later switch to an authorized MIMIC index.

Retrieval is triggered only when at least one model probability is within `RADSYN_UNCERTAINTY_DELTA` of its validation-selected threshold. Candidate cases are restricted to the same model-selected retrieval class; the score combines normalized model score vectors and compact Grad-CAM coordinate descriptors (65% / 35%). This is a prototype similarity heuristic, not a validated clinical retrieval metric or lung-localization method. The classifier was not trained on the IU dataset, and the retrieved class is model-derived rather than an IU ground-truth label. Do not interpret a similarity score as diagnostic confidence.

## Configure LLM summaries

Set these backend environment variables before starting FastAPI:

```cmd
set OPENAI_API_KEY=your-api-key
set OPENAI_MODEL=your-enabled-model
```

The summary uses only the supplied model probability scores and retrieved report text. It must be interpreted as non-diagnostic research context. Without these variables, retrieval still works but `/summarize` returns HTTP 503.

## Notes

This is a research prototype, not a diagnostic service. The index contains local image paths and historical report excerpts; do not commit the dataset, SQLite index, or API keys. Check the dataset terms before redistributing source files, transformed images, or derived datasets.

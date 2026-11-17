# RadSync API

## Run locally (Windows CMD)

From the repository root:

```cmd
venv\Scripts\activate.bat
pip install -r Server\requirements.txt
python -m uvicorn Server.main:app --host 127.0.0.1 --port 8000
```

The trained checkpoint is expected at `models/densenet121_best.pth`. The predictor uses CUDA automatically when PyTorch detects a compatible NVIDIA GPU.

## Endpoints

- `GET /health` — API, model device, selected retrieval-index status/source, and optional LLM configuration.
- `POST /predict` — multipart field `file`; returns five DenseNet121 sigmoid probabilities.
- `POST /gradcam` — multipart fields `file` and `disease`; returns a computed Grad-CAM overlay as a PNG data URL.
- `POST /retrieve` — multipart fields `file` and optional `top_k`; performs uncertainty-triggered historical case retrieval.
- `POST /summarize` — JSON body containing model probabilities and retrieved report excerpts. Uses the configured OpenAI model when available; otherwise returns a clearly labelled local evidence summary.

Accepted image uploads: PNG/JPEG, maximum 10 MB.

## Indiana University / Open-i retrieval (current MVP dataset)

Keep the downloaded dataset outside Git. The expected local layout is:

```text
D:\archive\
  indiana_reports.csv
  indiana_projections.csv
  images\
    images_normalized\
      *.dcm.png
```

The index builder joins reports and images by `uid`, indexes only rows marked `Frontal`, and uses the report's indication, comparison, findings, impression, MeSH terms, and problems as contextual text. Lateral images are intentionally skipped in this first version.

Build a small smoke-test index first (50 new frontal images):

```cmd
python -m ml.build_iu_index --limit 50
```

After confirming the output, index the remaining frontal images. Existing case IDs are skipped, so rerunning this command resumes rather than duplicating cases:

```cmd
python -m ml.build_iu_index --limit 3818
```

The default SQLite output is `data/iu_index.sqlite`. The builder computes DenseNet121 probabilities and a Grad-CAM spatial descriptor for each image. This uses GPU inference when CUDA is available and can take time for the full dataset.

Before starting FastAPI in the same CMD session, select the IU index:

```cmd
set RADSYN_IU_INDEX=data/iu_index.sqlite
python -m uvicorn Server.main:app --host 127.0.0.1 --port 8000
```

The backend checks `RADSYN_RETRIEVAL_INDEX`, then `RADSYN_IU_INDEX`, then the legacy `RADSYN_MIMIC_INDEX`. With none set, it defaults to `data/iu_index.sqlite`. `RADSYN_DATASET_LABEL` can override the source label returned by the API.

## MIMIC-CXR retrieval (legacy option)

MIMIC-CXR is not bundled in this repository. Obtain authorized access to MIMIC-CXR / MIMIC-CXR-JPG and its de-identified report text files separately. The existing `ml.build_mimic_index` script remains available and is not changed by the IU workflow.

The MIMIC index builder expects:
- A metadata CSV containing `subject_id`, `study_id`, and `dicom_id`. If a `path` column exists, it is used for image paths.
- The MIMIC-CXR-JPG directory containing `files/`.
- Matching study report text files at `files/pXX/pSUBJECT/sSTUDY.txt`.

Example:

```cmd
python -m ml.build_mimic_index --metadata-csv "D:\MIMIC\mimic-cxr-2.0.0-metadata.csv" --image-root "D:\MIMIC"
```

Set `RADSYN_MIMIC_INDEX` to select a non-default MIMIC index path.

## Retrieval method and limitations

Retrieval is triggered only when at least one disease probability is within `RADSYN_UNCERTAINTY_DELTA` of its validation-selected threshold. Similarity combines normalized disease-score vectors (65%) and Grad-CAM region descriptors (35%). The current region descriptor is based on normalized image coordinates and coarse quadrants; it is not lung-segmentation-aware or clinically validated.

The DenseNet121 model was trained on a different dataset from the IU reference collection. The IU reports are historical context, not ground truth labels for the model, and similarity scores are prototype ranking scores rather than calibrated clinical probabilities. RadSync is a research prototype, not a diagnostic service.

## Recalculate classifier metrics from saved predictions

The original NIH image archive is required for a fresh image-inference evaluation using `python ml\\evaluate_model.py`. If the archive is unavailable but the saved `ml/evaluation/test_predictions.npz` and validation-selected `ml/evaluation/thresholds.csv` are present, the metrics can be reproduced without loading any images or the model.

Install the small evaluation dependencies and run from the repository root:

```cmd
pip install -r ml\\requirements-evaluation.txt
python -m ml.evaluate_saved_predictions
```

The script writes `ml/evaluation/test_metrics_summary.json` and `ml/evaluation/test_metrics_by_class.csv`. It reports per-class accuracy, precision, recall/sensitivity, specificity, F1, and ROC-AUC, along with macro and micro averages and exact-match (subset) accuracy.

Macro class accuracy is the mean of the five one-vs-rest accuracies and includes true negatives. Exact-match accuracy counts a study as correct only when all five disease labels match. ROC-AUC is evaluated across probability thresholds; F1 and accuracy use the thresholds selected on the validation split. Do not present macro class accuracy without explaining its definition.

## Evaluate Indiana University historical retrieval

After building `data/iu_index.sqlite`, run the leave-one-case-out evaluation from the repository root:

```cmd
python -m ml.evaluate_iu_retrieval
```

The evaluator reuses vectors and de-identified report text already stored in SQLite; it does not reload the model, run inference, or require the image archive. It excludes each query case from its candidate list and ranks only cases in the same model-assigned retrieval class, matching the current retrieval filter.

Weak relevance states are derived from explicit disease mentions in IU MeSH / Problems fields and explicit positive or negated mentions in Findings / Impression. A disease not mentioned in a report is treated as unjudged, not as a negative label. Metrics are calculated among cases with judged positive or negative report mentions. The report includes per-class model/report label alignment, Precision@K, Recall@K, MAP@K, NDCG@K, and a random-ranking precision baseline. It compares the current 65% score-vector + 35% Grad-CAM-region ranking against score-only and region-only ablations.

By default, the script writes JSON, per-class CSV, and per-query CSV files to `data/iu_retrieval_evaluation/`, which is git-ignored. These are weak-label research metrics only: the reports are not expert-adjudicated relevance judgments, the evaluation is leave-one-case-out within the same collection (not external validation), and patient-level separation cannot be guaranteed because the current index does not store patient identifiers. Do not describe these metrics as clinical validation.

## Configure optional OpenAI summaries

The backend loads `Server/.env` automatically. Create the local file from the example:

```cmd
copy Server\.env.example Server\.env
```

Open `Server/.env` and set:

```dotenv
OPENAI_API_KEY=your-secret-api-key
OPENAI_MODEL=gpt-5.6-luna
```

Keep the key in this backend-only file. It is covered by the repository's `.gitignore`; never place it in `Client/.env`, frontend source, screenshots, or commits. Environment variables already set in the shell take precedence over values in `Server/.env`.

Install the backend dependencies after pulling these changes:

```cmd
pip install -r Server\requirements.txt
```

Restart FastAPI after editing the environment file. The `/health` endpoint reports whether both LLM variables are configured, and `/summarize` uses the OpenAI Responses API when configured. Without them, the endpoint falls back to a labelled local evidence summary. Neither summary diagnoses the uploaded image.

## Dataset and local data handling

Follow the license and terms attached to the exact Indiana dataset copy you downloaded. Do not redistribute the dataset or publish its derived index unless the applicable terms permit it. The SQLite index stores local image paths, report excerpts, and derived vectors; keep it local and do not commit it. Do not commit API keys or private credentials.

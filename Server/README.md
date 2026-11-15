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

- `GET /health` — API/model status.
- `POST /predict` — multipart field `file`; returns five DenseNet121 sigmoid probabilities.
- `POST /gradcam` — multipart fields `file` and `disease`; returns a computed Grad-CAM overlay as a PNG data URL.

Accepted uploads: PNG/JPEG, maximum 10 MB.

## Configuration

Set `CORS_ORIGINS` to a comma-separated list of frontend origins. The default allows common local Vite/TanStack development origins.

This is a research prototype, not a diagnostic service. Historical MIMIC-CXR retrieval and LLM summary routes are not implemented yet.

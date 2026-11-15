# RadSyn Client

## Run locally

1. From the repository root, start the FastAPI backend as described in `Server/README.md`.
2. In another terminal:

   ```powershell
   cd Client
   bun install
   Copy-Item .env.example .env.local
   bun run dev
   ```

Set `VITE_API_BASE_URL` in `.env.local` if the API is not at `http://127.0.0.1:8000`.

## Implemented integration

- `POST /predict`: real DenseNet121 inference for five diseases.
- `POST /gradcam`: computed, class-specific Grad-CAM overlay.
- `POST /retrieve`: uncertainty-triggered historical case retrieval from the configured MIMIC-CXR SQLite index.
- `POST /summarize`: optional grounded, non-diagnostic summary of the retrieved report excerpts.

Historical cases only appear after the authorized MIMIC-CXR dataset has been indexed. LLM summaries additionally require the backend `OPENAI_API_KEY` and `OPENAI_MODEL` variables.

## Checks

```powershell
bun run lint
bunx tsc --noEmit
bun run build
bun test
```

Uploaded case data currently lives in browser React state and is lost on page refresh. Persistent case history and authentication are not part of this integration.

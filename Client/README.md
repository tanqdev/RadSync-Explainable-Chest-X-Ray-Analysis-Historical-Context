# RadSync Client

## Run locally (Windows CMD)

1. From the repository root, start the FastAPI backend as described in `Server/README.md`.
2. In a second terminal:

   ```cmd
   cd Client
   bun install
   bun run dev
   ```

Set `VITE_API_BASE_URL` in `.env.local` when the API is not at `http://127.0.0.1:8000`.

## Backend integration

- `POST /predict`: DenseNet121 inference for five thoracic findings.
- `POST /gradcam`: computed, class-specific Grad-CAM overlay.
- `POST /retrieve`: uncertainty-triggered historical retrieval from the configured local SQLite index (Indiana University / Open-i by default).
- `POST /summarize`: local evidence summary by default; optional Gemini-powered report summary when configured.

The IU image/report collection must be obtained and indexed locally before historical cases appear. The frontend handles unavailable indexes and untriggered retrieval. Historical reports are contextual references, not labels for the current image.

## Checks

```cmd
bunx tsc --noEmit
bun run build
bun run test
```

Uploaded case data currently lives in browser React state and is lost on page refresh. Persistent user accounts and server-side case history are not part of this prototype.

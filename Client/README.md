# RadSyn Client

## Run locally

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env.local`:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Start the frontend:

   ```powershell
   npm run dev
   ```

Set `VITE_API_BASE_URL` in `.env.local` to the FastAPI backend URL. The client uses `POST /predict` for classification and `POST /gradcam` for computed Grad-CAM overlays.

Historical case retrieval and LLM summaries are not connected yet; the UI displays these components as unavailable until the MIMIC-CXR index and summary service are configured.

## Checks

```powershell
npm run lint
npm run build
npm test
```

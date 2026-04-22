# Review Report Simulator

Standalone frontend app for testing `review-backend` using the same generate workflow as the extension, without serving UI from the backend project.

## Run

1. Start backend separately:

```bash
cd review-backend
bun run dev
```

2. Open the simulator:
- open `review-report-simulator/index.html` directly, or
- serve this folder with any static server.

3. In backend `.env`, for local browser access:

```env
CORS_ALLOWED_ORIGINS=*
```

4. To browse protected review history, also configure backend Basic Auth:

```env
TEMPLATES_LAB_USERNAME=admin
TEMPLATES_LAB_PASSWORD=secret
```

## What it accepts

- normalized state JSON (`original` / `current`)
- raw `getReviewActionDataById` TRPC stream payloads (it normalizes them locally)
- direct file upload for `ORIGINAL` and `CURRENT` JSON (loaded into textareas automatically)

## What it renders

- generated review response from `POST /api/review/generate` (includes `prepared` metrics + `llm` payload)
- reconstructed prompt + metrics from protected history entries via `GET /api/review-history`
- row-level text diffs for stable segment pairs
- structural segmentation events: split, merge, added, deleted
- side-by-side initial/final segment lanes
- raw backend JSON response for debugging

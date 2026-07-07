# Audio Overlap Deduplication Product

The audio overlap product lives in two child repos:

- `audio/audio-overlap-backend/`: FastAPI backend, matcher, database schema, worker scaffold, and Docker Compose.
- `audio/audio-overlap-extension/`: MV3 extension that automatically queries full task audio and applies accepted overlap text.

The extension workflow is automatic:

1. Wait for the task's visible full `<audio>` source.
2. Upload the full audio to `/v1/audio/query-overlap`.
3. Show a Gold Drafting style overlap dialog when matches are available.
4. Apply accepted transcript text only to rows covered by matched audio.
5. Mark changed rows with green checkmarks.
6. Ingest the completed full audio and row transcript when the worker continues/submits a not-fully-matched task.

The parent repo remains an aggregator. Product code, tests, packaging, and release flow belong to the child repos.

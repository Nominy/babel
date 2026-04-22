# Babel Review Feedback Assistant Spec (Draft v0.3, Local-First + OpenRouter)

## 1. Objective

Build a **local-first Chrome extension** that generates reviewer feedback by comparing two `getReviewActionDataById` states:
- `ORIGINAL`: captured early and cached.
- `NEW`: captured/refetched when reviewer requests feedback.

The extension computes quality metrics locally, sends an engineered feature packet to OpenRouter, and renders structured feedback in UI.

Output must include exactly 5 categories, each with:
- `score`: integer `1..3` (`1` best, `3` worst)
- `note`: short text (`<= 500` chars, target `~100` chars), with specific advice and kind wording

Categories:
1. Word Accuracy
2. Timestamp Accuracy
3. Punctuation & Formatting
4. Tags & Emphasis
5. Segmentation

## 2. Scope

### In Scope
- Intercept review APIs in browser.
- Parse TRPC streamed/chunked response format.
- Build and cache `ORIGINAL` and `NEW` states locally.
- Compute rule-based metrics locally in extension.
- Call OpenRouter directly from extension (no required backend).
- Render and optionally insert generated feedback in UI.

### Out of Scope (MVP)
- Auto-submit review without user confirmation.
- Team-level analytics backend.
- Audio re-alignment/ASR recalculation.

## 3. Key Constraint / Caveat

Word Accuracy is scored as **relative change quality between ORIGINAL and NEW**, not against an external gold transcript.

## 4. High-Level Architecture

1. **Injected Interceptor (page context)**
- Hooks `fetch` and `XMLHttpRequest`.
- Captures:
  - `claimNextReviewActionFromReviewQueue`
  - `getReviewActionDataById`
- Extracts `reviewActionId/actionId`.
- Auto-calls `getReviewActionDataById` when claim-next is captured.

2. **Content Script / UI Layer**
- Receives captured request/response events.
- Shows floating panel (hide-to-side behavior).
- Shows extracted IDs and payload snapshots.

3. **Extension Local Engine (service worker or content runtime)**
- Parses TRPC frame streams.
- Normalizes data into state model.
- Maintains local cache (`ORIGINAL`, latest `NEW`).
- Computes feature packet (metrics + evidence snippets).
- Calls OpenRouter.
- Validates model output schema.

4. **OpenRouter API**
- Receives compact feature packet + rubric prompt.
- Returns strict JSON feedback object.

## 5. Data Flow

1. Reviewer enters review mode.
2. Extension intercepts claim-next response and extracts `reviewActionId`.
3. Extension calls `getReviewActionDataById` and stores as `ORIGINAL` if not set.
4. Reviewer edits transcription.
5. User clicks `Generate Feedback`.
6. Extension refetches `getReviewActionDataById` for latest `NEW`.
7. Extension computes deltas (`ORIGINAL` vs `NEW`) and builds feature packet.
8. Extension calls OpenRouter.
9. Extension validates response and renders feedback.

## 6. Intercepted Payload Notes

`getReviewActionDataById` may arrive as concatenated TRPC JSON frames (`}{` stream), not a single JSON document.

Useful fields:
- `annotations[]`:
  - `content`
  - `processedRecordingId`
  - `startTimeInSeconds`, `endTimeInSeconds`
  - `metadata`
- `transcriptionChunkProcessedRecordings[]` (speaker mapping)
- `actionId`, `actionLevel`, `actionDecision`
- tags in content (`[смешок]`, `{СКАЗ: ...}`, etc.)
- `lintErrors[]` if present

Sensitive/irrelevant for model:
- `processedRecordingUriMap`
- worker identifiers

## 7. Local Normalized State

```json
{
  "reviewSessionId": "uuid-or-deterministic-key",
  "original": {
    "actionId": "uuid",
    "actionLevel": 1,
    "actionDecision": "pass",
    "annotations": [],
    "recordings": []
  },
  "current": {
    "actionId": "uuid",
    "actionLevel": 2,
    "actionDecision": "pending",
    "annotations": [],
    "recordings": []
  },
  "meta": {
    "capturedAt": "ISO-8601",
    "updatedAt": "ISO-8601",
    "source": "babel-extension"
  }
}
```

Normalization rules:
- Preserve UTF-8 text.
- Sort annotations by time.
- Preserve inline tags.
- Strip non-essential sensitive fields before model input.

## 8. OpenRouter Integration

### Endpoint
- `POST https://openrouter.ai/api/v1/chat/completions`

### Required Headers
- `Authorization: Bearer <OPENROUTER_API_KEY>`
- `Content-Type: application/json`

### Optional Headers
- `HTTP-Referer: <extension site/project url>`
- `X-Title: Babel Review Assistant`

### Request Strategy
- System prompt: rubric + scoring rules + style constraints.
- User payload: **feature packet only** (not raw full JSON), plus short evidence snippets.
- Request JSON-mode response contract (or strict schema via model instructions).

### Local Output Validation
- Must contain all 5 categories (exact names).
- Scores must be integer in `1..3`.
- Notes must be non-empty and <= 500 chars.
- If invalid: one repair retry with stricter prompt.

## 9. Engineered Feature Packet (Local -> LLM)

Example structure:
```json
{
  "session": { "actionId": "uuid" },
  "deltas": {
    "segment_count_delta": 0,
    "avg_segment_duration_delta_ms": 35,
    "new_segments": 2,
    "removed_segments": 1,
    "timestamp_shift_start_ms": { "mean": 42, "p95": 180, "max": 420 },
    "timestamp_shift_end_ms": { "mean": 38, "p95": 160, "max": 390 },
    "token_insertions": 18,
    "token_deletions": 7,
    "token_replacements": 11,
    "punctuation_delta": { "added": 12, "removed": 3, "suspicious": 4 },
    "tag_delta": { "added": 3, "removed": 1, "invalid": 0 }
  },
  "lint": {
    "errors_before": 4,
    "errors_after": 2,
    "top_reasons": ["Double spaces are not allowed in text."]
  },
  "evidence": [
    {
      "category_hint": "Timestamp Accuracy",
      "time": [32.19, 33.98],
      "before": "text A",
      "after": "text B",
      "issue": "large end shift"
    }
  ]
}
```

## 10. Scoring Rubric (1 Best -> 3 Worst)

### Word Accuracy
- `1`: NEW preserves or improves lexical correctness vs ORIGINAL.
- `2`: Mixed quality change.
- `3`: NEW introduces frequent lexical/transcription issues.

### Timestamp Accuracy
- `1`: Shifts small/consistent; boundaries plausible.
- `2`: Moderate shift anomalies.
- `3`: Frequent large shifts or boundary issues.

### Punctuation & Formatting
- `1`: Readable and mostly correct punctuation/format.
- `2`: Recurrent punctuation/format issues.
- `3`: Frequent punctuation/format issues that reduce clarity.

### Tags & Emphasis
- `1`: Tags/emphasis used correctly and consistently.
- `2`: Occasional misuse.
- `3`: Frequent misuse/inconsistency.

### Segmentation
- `1`: Segment boundaries/grouping are logical.
- `2`: Some awkward split/merge choices.
- `3`: Widespread segmentation quality problems.

## 11. Note Policy

Each note must:
- be `<= 500` chars, target `80..140`
- include one concrete action
- include one kind/positive phrase
- reference specific observable evidence when possible

## 12. Local Rule Engine Signals

- token diff metrics (insert/delete/replace)
- changed-segment ratio
- punctuation delta and anomaly counts
- tag delta and invalid-tag checks
- timestamp shift metrics (mean/p95/max)
- overlap/gap checks by speaker stream
- duration outlier checks
- segmentation merge/split indicators
- lint-error delta (if lint data exists)

## 13. Local Caching Strategy

Storage:
- `chrome.storage.local` (default)

Cache key:
- `reviewSessionId` (derived from action/chunk context)

Stored:
- `original`
- latest `current`
- hashes
- timestamps
- latest generated feedback

TTL:
- 10 minutes for `current` refresh guidance
- `original` pinned until session ends/reset

## 14. API Key & Security

- API key entered by user in extension settings.
- Store key in `chrome.storage.local` only.
- Never send platform cookies/tokens to OpenRouter.
- Never send full raw payload if not needed.
- Strip URI/worker-identifying fields from model input.
- Add clear "Delete local data" and "Reset API key" controls.

## 15. Extension Permissions (MVP)

- `host_permissions`:
  - `https://dashboard.babel.audio/*`
  - `https://openrouter.ai/*`
- `permissions`:
  - `storage`

## 16. Failure Handling

Client-side:
- parse failure -> show inline error + retry
- missing `ORIGINAL` -> attempt one refetch
- OpenRouter failure -> show error with retry
- schema validation failure -> one automatic repair retry

Fallback:
- if model unavailable, show deterministic heuristic summary template

## 17. Observability (Local MVP)

Track locally:
- parse success/failure
- feature packet generation time
- OpenRouter latency/error rate
- validation failure/retry count
- user accept/copy/insert actions

## 18. MVP Milestones

1. Interceptor + ID extraction + auto follow-up fetch (done/in progress).
2. TRPC parser + normalized state cache (`ORIGINAL`/`NEW`).
3. Local feature engine (timestamp shifts, segment deltas, tag/punctuation deltas).
4. OpenRouter settings UI + direct API call + schema validation.
5. Feedback UI and one-click insert.

## 19. Open Questions

1. Which OpenRouter model is default for quality/cost/latency?
2. Do we keep optional backend mode as future fallback?
3. Should notes be generated in reviewer UI language or transcript language?
4. Should local telemetry export be added for debugging?

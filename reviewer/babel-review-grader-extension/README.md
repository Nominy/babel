# Babel Review Grader

A separately installable MV3 addon for **Babel Review Helper**. It restores the
five-category grading behavior that was removed from Review Helper and lets you
preview, adjust, and apply grades without changing feedback notes or submitting
the review.

## Install locally

1. Update and rebuild `../review-interceptor-extension` (`npm run build:dev`).
2. Update the review backend to include `POST /api/review/grade`. This endpoint
   uses your OpenRouter key saved in Review Helper and the backend's model configuration.
3. Run `npm ci`, then `npm run build` in this directory.
4. In Chrome Extensions, enable Developer mode and load this directory unpacked.
5. Reload Review Helper and refresh the Babel dashboard.

For a local backend, use Review Helper's development build and set its backend
address to `http://127.0.0.1:<port>`. The addon also supports the normal
`https://reviewgen.ovh` service once the updated backend is deployed. An older
backend produces an explicit setup error; it never falls back to placeholder grades.

Open the native L1 feedback form, click **Grade review**, then **Generate grades**.
Inspect the evidence and change any suggested grade before clicking **Apply grades**.
Review Helper supplies a freshly fetched L1 original and current review snapshot.
Before applying, the addon refetches them and rejects grades if the transcript changed.

The five categories are Word Accuracy, Timestamp Accuracy, Punctuation & Formatting,
Tags & Emphasis, and Segmentation. The restored scale is **1 = isolated or no material
issues, 2 = repeated issues, 3 = systemic issues**. These grades describe corrections
between L1 and the reviewed transcript; they do not independently assess the audio.

## Recovery provenance

- Review Helper `79d319c` (2026-03-12) removed score selection and retry verification
  from `content.js`, leaving note application intact. Its parent preserves that flow.
- Review backend `402a1e2` (2026-03-02) contains the last dedicated attribution-based
  grading pipeline before the template selection architecture replaced grading.
- Recovered backend sources live in `../review-backend/src/apps/grading/legacy`.
  See that application's README for retained rules and deliberate corrections.

The addon uses a versioned page bridge exposed by Review Helper. It
does not duplicate the network interceptor or read another extension's storage.
Review Helper owns the backend request and attaches its saved key; the addon never receives the raw key. Transcript snapshots stay in page
memory and are sent only when generating; compact category evidence is sent to
OpenRouter by the backend. No grade history or submit analytics is stored by this addon.

## Validation and packaging

```sh
npm run typecheck
npm test
npm run build:zip
```

The ZIP is written to `.artifacts/babel-review-grader-0.1.0.zip`. Browser integration
tests are in the shared platform's `grader.spec.mjs` and use synthetic local data.
They run with Review Helper installed and also test the missing-dependency case.

This package has no publishing automation and has not been published to the Chrome
Web Store. Local backend access is provided by Review Helper.

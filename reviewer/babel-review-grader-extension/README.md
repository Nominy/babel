# Babel Review Grader

## Install and build

Requires Node.js 22.14+, [Review Helper](../review-interceptor-extension/README.md), the shared platform at `../../shared/babel-extension-platform`, and the current [backend](../review-backend/README.md) with `/api/review/grade`.

Initialize the parent checkout with `git submodule update --init --recursive`. From this directory:

```sh
npm --prefix ../../shared/babel-extension-platform ci
npm ci
npm run build
```

Load this directory unpacked in `chrome://extensions`; bundles go to `dist/`. Reload Review Helper and refresh the Babel dashboard. Configure the backend address and OpenRouter key in Review Helper, not this addon. Use Review Helper's development build for a local backend.

Review Grader is independent of Gold/Helper audio enhancement. It is not required to enable ZipEnhancer; its former access-provider background worker has been removed.

## Checks and packaging

```sh
npm run typecheck
npm test
npm run build:zip
```

The Store ZIP goes to `.artifacts/babel-review-grader-<version>.zip`; it intentionally omits the test identity key. Builds do not bump versions. Publish with `npm run publish:cws -- --env-file PATH_TO_IGNORED_CWS_CONFIG --publish-type STAGED_PUBLISH --skip-review false`. Configure the existing Grader item `nkeipbljoogklaflfmkiffhflfdpjefc`, not Gold's item or the unpacked test ID, using the shared publisher's `CWS_ITEM_URL` or `CWS_PUBLISHER_ID`/`CWS_EXTENSION_ID` settings. Credentials remain outside source control.

Browser integration uses `npm run e2e -- --grader` from the [shared platform](../../shared/babel-extension-platform/README.md#browser-checks).

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

## ZipEnhancer access

Version 0.1.1 adds the background access provider for Gold Drafting and Babel Helper's audio enhancement. The manifest's pinned public key keeps this addon at `geagfgdjmeojbkbdjmbchkhjjfpaffbe`; do not remove or replace it. Only allowlisted extension identities can request the nonce-bound, heartbeat-maintained `audio-enhancement` grant. Web pages cannot grant access through DOM markers or `postMessage`.

Keep Grader installed and enabled for enhancement, including dedicated swarm GPU workers. Disabling/removing it cancels enhancement, restores Original audio and removes enhancement controls/settings; other Gold/Helper functionality is unchanged. Older content-only builds do not unlock enhancement: rebuild/reload this updated addon, including `dist/background.js`. Existing review grading still uses Review Helper and its backend configuration.


## Checks and packaging

```sh
npm run typecheck
npm test
npm run build:zip
```

The ZIP goes to `.artifacts/babel-review-grader-<version>.zip`. Builds do not bump versions. There is no store publishing automation.

Browser integration uses `npm run e2e -- --grader` from the [shared platform](../../shared/babel-extension-platform/README.md#browser-checks).

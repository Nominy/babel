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

## Checks and packaging

```sh
npm run typecheck
npm test
npm run build:zip
```

The ZIP goes to `.artifacts/babel-review-grader-<version>.zip`. Builds do not bump versions. There is no store publishing automation.

Browser integration uses `npm run e2e -- --grader` from the [shared platform](../../shared/babel-extension-platform/README.md#browser-checks).

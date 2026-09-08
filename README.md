# Babel

## Bootstrap

Install Git, Node.js 22.14+ with npm, and Bun 1.3+ for the backend. From PowerShell:

```powershell
git clone --recurse-submodules https://github.com/Nominy/babel.git
cd babel
# Existing checkout:
git submodule update --init --recursive

npm --prefix shared/babel-extension-platform ci
npm --prefix babel-helper-extension-repo ci
npm --prefix drafting/gold-drafting-extension ci
npm --prefix reviewer/review-interceptor-extension ci
npm --prefix reviewer/babel-review-grader-extension ci
bun install --cwd reviewer/review-backend
```

## Build and load extensions

Run from this directory. Enable Developer mode in `chrome://extensions`, then load the indicated folder unpacked.

| Product | Command | Load folder |
| --- | --- | --- |
| [Helper](babel-helper-extension-repo/README.md) | `npm --prefix babel-helper-extension-repo run build` | `babel-helper-extension-repo/babel-helper-extension/` |
| [Gold Drafting](drafting/gold-drafting-extension/README.md) | `npm --prefix drafting/gold-drafting-extension run build` | `drafting/gold-drafting-extension/` |
| [Review Helper](reviewer/review-interceptor-extension/README.md) | `npm --prefix reviewer/review-interceptor-extension run build:dev` | `reviewer/review-interceptor-extension/build/dev/` |
| [Review Grader](reviewer/babel-review-grader-extension/README.md) | `npm --prefix reviewer/babel-review-grader-extension run build` | `reviewer/babel-review-grader-extension/` |

Helper and Gold `build` commands bump the patch version. For a no-bump rebuild, use `build:core`; Helper also needs `sync:unpacked`. Reload extensions and refresh dashboard tabs after rebuilding. Review Grader requires Review Helper and the current backend. Configure user OpenRouter keys in extension settings for model requests.

## Run the backend

```powershell
Copy-Item reviewer/review-backend/.env.runtime.example reviewer/review-backend/.env.runtime
# Edit .env.runtime; replace the example admin credentials before starting.
npm --prefix shared/babel-extension-platform run e2e:install:recreation
bun run --cwd reviewer/review-backend build:lab
bun run --cwd reviewer/review-backend dev
```

Backend: `http://127.0.0.1:3001`; health: `/health`; admin: `/templates-lab`. See [backend deployment](reviewer/review-backend/README.md) for credentials, data and production commands.

For the GPU service, follow [L0 Draft Engine installation](drafting/l0-draft-engine/README.md) (Docker/NVIDIA on Linux or Python/NVIDIA on Windows).

[Shared browser setup and commands](shared/babel-extension-platform/README.md) are separate from ordinary extension builds. Packaging and store publishing commands remain in each product README; ZIPs go to `.artifacts/`, not source control.

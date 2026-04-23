# Repo Map

This workspace keeps grouped product paths intact and uses the parent repo only as a thin aggregator.

## Ownership Rules

| Path | Status | Canonical Owner | Nested Submodules Allowed |
| --- | --- | --- | --- |
| `babel-helper-extension-repo/` | remote-backed submodule | `Nominy/babel-helper-extension` | yes, if owned by that repo |
| `drafting/gold-drafting-extension/` | remote-backed submodule | `Nominy/babel-gold-drafting-extension` | yes, if owned by that repo |
| `reviewer/review-backend/` | remote-backed submodule | `Nominy/review-backend` | yes, if owned by that repo |
| `reviewer/review-interceptor-extension/` | remote-backed submodule | `Nominy/review-extension` | yes, if owned by that repo |
| `shared/babel-extension-platform/` | remote-backed submodule | `Nominy/babel-extension-platform` | yes, if owned by that repo |
| parent root docs/config | plain parent content | parent aggregator repo | no parent-managed nesting here |

## Parent Repo Contract

- The parent repo tracks only the five child repo pointers plus minimal bootstrap/docs content.
- The parent repo does not replace child histories or combine them into one root history.
- Product repos own their own packaging and release flows.
- Packaged ZIPs are published through per-repo GitHub Releases, not checked into this parent repo.
- Non-product experiments, exports, old ZIPs, screenshots, and similar archive material live in a local archive directory, not in this workspace.
- When cloning the parent repo, initialize submodules recursively:

```powershell
git submodule update --init --recursive
```

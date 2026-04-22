# Repo Map

This workspace keeps grouped paths intact and uses the parent repo only as an aggregator.

## Ownership Rules

| Path | Status | Canonical Owner | Nested Submodules Allowed |
| --- | --- | --- | --- |
| `tools/` | remote-backed submodule | `Nominy/babel-tools` | yes, if owned by `tools` |
| `babel-helper-extension-repo/` | remote-backed submodule | `Nominy/babel-helper-extension` | yes, if owned by that repo |
| `reviewer/review-backend/` | remote-backed submodule | `Nominy/review-backend` | yes, if owned by that repo |
| `reviewer/review-interceptor-extension/` | remote-backed submodule | `Nominy/review-extension` | yes, if owned by that repo |
| `prototyping/` | remote-backed submodule | `Nominy/audio-segmentation-editor` | yes, if the repo later needs them |
| `drafting/gold-drafting-extension/` | remote-backed submodule | `Nominy/babel-gold-drafting-extension` | yes, if the repo later needs them |
| `reviewer/` outside child repos | plain parent content | parent aggregator repo | no parent-managed nesting here |
| `drafting/` outside `gold-drafting-extension/` | plain parent content | parent aggregator repo | no parent-managed nesting here |
| `counter/` | plain parent content | parent aggregator repo | no |
| parent root docs/config | plain parent content | parent aggregator repo | no |

## Helper Extension Rule

- `babel-helper-extension-repo/` is the canonical helper-extension repository.
- `tools/babel-helper-extension/` stays inside `tools/` as archive and local history content in v1.
- Do not reintroduce the standalone helper repo as a nested submodule under `tools/` during this cleanup.

## Parent Repo Contract

- The parent repo tracks submodule pointers plus wrapper/docs content.
- The parent repo does not replace child histories or combine them into one root history.
- When cloning the parent repo, initialize submodules recursively:

```powershell
git submodule update --init --recursive
```

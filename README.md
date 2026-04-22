# Babel Workspace Aggregator

This repository is the thin parent workspace for the durable Babel product stack.

It is an aggregator and navigation layer, not the canonical home of the product histories.
Child repositories keep their own commits, remotes, release flows, and ownership.

## Layout

| Path | Type | Canonical Source Of Truth |
| --- | --- | --- |
| `babel-helper-extension-repo/` | remote-backed submodule | `Nominy/babel-helper-extension` |
| `drafting/gold-drafting-extension/` | remote-backed submodule | `Nominy/babel-gold-drafting-extension` |
| `reviewer/review-backend/` | remote-backed submodule | `Nominy/review-backend` |
| `reviewer/review-interceptor-extension/` | remote-backed submodule | `Nominy/review-extension` |
| wrapper docs/config (`README.md`, `.gitmodules`, `docs/`) | plain parent content | this aggregator repo |

## Bootstrap

Fresh setup from the parent repo:

```powershell
git clone <this-repo> babel
cd babel
git submodule update --init --recursive
```
If any child repo moves to a new path or remote later, update the URL and run:

```powershell
git submodule sync --recursive
git submodule update --init --recursive
```

## Archive Contract

- Non-product material lives outside this git workspace under `C:\Users\User\Desktop\dev\babel-archive\`.
- Packaged extension ZIPs do not belong in this parent repo or in wrapper folders. The canonical distributables now live in per-repo GitHub Releases.
- `reviewer/` and `drafting/` stay only as grouping directories for the child repos above.
- Child repos may own their own nested submodules when that structure belongs to the child. The parent should always bootstrap with `--recursive`.

See [`docs/repo-map.md`](docs/repo-map.md) for the ownership rules in one place.

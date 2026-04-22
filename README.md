# Babel Workspace Aggregator

This repository is the parent workspace for the Babel projects in this directory.

It is an aggregator and navigation layer, not the canonical home of most code histories.
Child repositories keep their own commits, remotes, release flows, and nested ownership where needed.

## Layout

| Path | Type | Canonical Source Of Truth |
| --- | --- | --- |
| `tools/` | remote-backed submodule | `Nominy/babel-tools` |
| `babel-helper-extension-repo/` | remote-backed submodule | `Nominy/babel-helper-extension` |
| `reviewer/review-backend/` | remote-backed submodule | `Nominy/review-backend` |
| `reviewer/review-interceptor-extension/` | remote-backed submodule | `Nominy/review-extension` |
| `prototyping/` | remote-backed submodule | `Nominy/audio-segmentation-editor` |
| `drafting/gold-drafting-extension/` | remote-backed submodule | `Nominy/babel-gold-drafting-extension` |
| `reviewer/` wrapper content outside the two repos | plain parent content | this aggregator repo |
| `drafting/` wrapper content outside `gold-drafting-extension/` | plain parent content | this aggregator repo |
| `counter/` | plain parent content | this aggregator repo |
| root docs/config | plain parent content | this aggregator repo |

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

## Notes

- `reviewer/` and `drafting/` intentionally remain grouped wrapper directories. The parent owns only the wrapper content outside their child repos.
- `tools/babel-helper-extension/` remains archive/history content inside the `tools` repo for now. The canonical helper extension repo is `babel-helper-extension-repo/`.
- Child repos may own their own nested submodules when that structure belongs to the child. The parent should always bootstrap with `--recursive`.

See [`docs/repo-map.md`](docs/repo-map.md) for the ownership rules in one place.

# Transcription Studio First Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first verifiable Transcription Studio vertical slice: a standalone Rust workspace with a Babel-shaped core model, local project materialization, import/export fixtures, command-based edits with undo/redo, and a minimal Iced timeline-first shell.

**Architecture:** Create a new standalone repository at `C:\Users\User\Desktop\dev\transcription-studio`. Keep domain logic out of Iced by placing project models and editor commands in `studio-core`, local save/load in `studio-project`, Babel package IO in `studio-babel`, and the native shell in `studio-app`.

**Tech Stack:** Rust 1.93 nightly, Cargo workspace, `serde`, `serde_json`, `anyhow`, `thiserror`, `tempfile`, `iced`.

---

## File Structure

- Create `C:\Users\User\Desktop\dev\transcription-studio\Cargo.toml`: workspace root.
- Create `C:\Users\User\Desktop\dev\transcription-studio\.gitignore`: Rust build output and local editor state ignores.
- Create `C:\Users\User\Desktop\dev\transcription-studio\README.md`: product scope and first-slice commands.
- Create `C:\Users\User\Desktop\dev\transcription-studio\crates\studio-core\Cargo.toml`.
- Create `C:\Users\User\Desktop\dev\transcription-studio\crates\studio-core\src\lib.rs`: exported core modules.
- Create `C:\Users\User\Desktop\dev\transcription-studio\crates\studio-core\src\model.rs`: project, speaker, lane, and segment data types.
- Create `C:\Users\User\Desktop\dev\transcription-studio\crates\studio-core\src\commands.rs`: typed editor commands and undo/redo history.
- Create `C:\Users\User\Desktop\dev\transcription-studio\crates\studio-core\tests\command_history.rs`: command model tests.
- Create `C:\Users\User\Desktop\dev\transcription-studio\crates\studio-project\Cargo.toml`.
- Create `C:\Users\User\Desktop\dev\transcription-studio\crates\studio-project\src\lib.rs`: local project manifest and save/load/materialization helpers.
- Create `C:\Users\User\Desktop\dev\transcription-studio\crates\studio-project\tests\materialize.rs`: local project round-trip tests.
- Create `C:\Users\User\Desktop\dev\transcription-studio\crates\studio-babel\Cargo.toml`.
- Create `C:\Users\User\Desktop\dev\transcription-studio\crates\studio-babel\src\lib.rs`: Babel package types, import normalization, export conversion.
- Create `C:\Users\User\Desktop\dev\transcription-studio\crates\studio-babel\tests\fixtures\sample-task.json`: two-speaker Babel-shaped sample package.
- Create `C:\Users\User\Desktop\dev\transcription-studio\crates\studio-babel\tests\round_trip.rs`: import/export fixture tests.
- Create `C:\Users\User\Desktop\dev\transcription-studio\crates\studio-app\Cargo.toml`.
- Create `C:\Users\User\Desktop\dev\transcription-studio\crates\studio-app\src\main.rs`: minimal timeline-first Iced shell.

## Task 1: Create Standalone Workspace Skeleton

**Files:**
- Create: all root files and crate manifests listed above.

- [ ] **Step 1: Create the repository directory and initialize Git**

Run:

```powershell
New-Item -ItemType Directory -Force -Path 'C:\Users\User\Desktop\dev\transcription-studio'
git -C 'C:\Users\User\Desktop\dev\transcription-studio' init
git -C 'C:\Users\User\Desktop\dev\transcription-studio' switch -c codex/transcription-studio-first-slice
```

Expected: Git initializes and the current branch is `codex/transcription-studio-first-slice`.

- [ ] **Step 2: Create workspace files**

Create root `Cargo.toml` with members `studio-core`, `studio-project`, `studio-babel`, and `studio-app`.

Create crate manifests with these package names:

```text
studio-core
studio-project
studio-babel
studio-app
```

Expected: `cargo metadata --no-deps` can discover all four crates.

- [ ] **Step 3: Verify skeleton**

Run:

```powershell
cargo metadata --no-deps
```

Expected: command exits `0` and lists all four workspace members.

- [ ] **Step 4: Commit skeleton**

Run:

```powershell
git add .
git commit -m "chore: scaffold transcription studio workspace"
```

Expected: first commit contains root files and empty crate shells.

## Task 2: Implement Core Model With TDD

**Files:**
- Create/modify: `crates/studio-core/src/model.rs`
- Create/modify: `crates/studio-core/src/commands.rs`
- Create/modify: `crates/studio-core/src/lib.rs`
- Test: `crates/studio-core/tests/command_history.rs`

- [ ] **Step 1: Write failing command tests**

Tests must cover:

- applying a text edit changes only the target segment
- moving a segment boundary validates `start < end`
- split creates two adjacent segments and keeps text on the left segment
- undo restores the previous project state
- redo reapplies the undone change

Run:

```powershell
cargo test -p studio-core
```

Expected: fail because the model and command types do not exist yet.

- [ ] **Step 2: Implement minimal model and commands**

Add serializable core types:

```rust
Project { id, name, speakers, lanes, segments, metadata }
Speaker { id, label }
AudioLane { id, speaker_id, label, source_path }
Segment { id, source_annotation_id, speaker_id, lane_id, start_seconds, end_seconds, text }
```

Add command enum:

```rust
EditorCommand::ApplyTextEdit { segment_id, text }
EditorCommand::MoveSegmentBoundary { segment_id, start_seconds, end_seconds }
EditorCommand::SplitSegment { segment_id, at_seconds, new_segment_id }
```

Add `CommandHistory` that stores previous and redo project snapshots for this first slice.

- [ ] **Step 3: Verify core tests pass**

Run:

```powershell
cargo test -p studio-core
```

Expected: all `studio-core` tests pass.

- [ ] **Step 4: Commit core model**

Run:

```powershell
git add crates/studio-core
git commit -m "feat: add core transcription command model"
```

Expected: commit contains model, commands, and tests.

## Task 3: Implement Babel Import/Export Fixture With TDD

**Files:**
- Create/modify: `crates/studio-babel/src/lib.rs`
- Create: `crates/studio-babel/tests/fixtures/sample-task.json`
- Create/modify: `crates/studio-babel/tests/round_trip.rs`

- [ ] **Step 1: Write failing round-trip tests**

Tests must load `sample-task.json`, normalize it into `studio_core::Project`, and export it back to a Babel package while preserving:

- source task id
- two speakers
- two audio tracks
- three annotations
- annotation ids
- speaker keys
- start/end seconds
- text

Run:

```powershell
cargo test -p studio-babel
```

Expected: fail because Babel package types and import/export functions do not exist yet.

- [ ] **Step 2: Implement Babel package adapter**

Use this public API:

```rust
pub fn import_package(package: BabelTaskPackage) -> Result<Project, BabelImportError>;
pub fn export_package(project: &Project) -> Result<BabelTaskPackage, BabelExportError>;
```

Represent the source package with:

```rust
BabelTaskPackage { task_id, project_preset, speakers, audio_tracks, annotations }
BabelSpeaker { speaker_key, label }
BabelAudioTrack { track_id, speaker_key, path }
BabelAnnotation { annotation_id, speaker_key, track_id, start_seconds, end_seconds, text }
```

- [ ] **Step 3: Verify Babel tests pass**

Run:

```powershell
cargo test -p studio-babel
```

Expected: all `studio-babel` tests pass.

- [ ] **Step 4: Commit Babel adapter**

Run:

```powershell
git add crates/studio-babel
git commit -m "feat: add babel package round trip"
```

Expected: commit contains adapter, fixture, and round-trip tests.

## Task 4: Implement Local Project Materialization With TDD

**Files:**
- Create/modify: `crates/studio-project/src/lib.rs`
- Create/modify: `crates/studio-project/tests/materialize.rs`

- [ ] **Step 1: Write failing materialization tests**

Tests must:

- save a `Project` to `project.json` and `segments.json`
- create `audio`, `rules`, `journal`, and `autosave` directories
- reload the project and preserve segments
- reject loading when either manifest file is missing

Run:

```powershell
cargo test -p studio-project
```

Expected: fail because materialization helpers do not exist yet.

- [ ] **Step 2: Implement materialization helpers**

Use this public API:

```rust
pub fn save_project(project: &Project, root: impl AsRef<Path>) -> Result<(), ProjectIoError>;
pub fn load_project(root: impl AsRef<Path>) -> Result<Project, ProjectIoError>;
```

Store project-level data in `project.json`, segment array in `segments.json`, and create the four support directories.

- [ ] **Step 3: Verify materialization tests pass**

Run:

```powershell
cargo test -p studio-project
```

Expected: all `studio-project` tests pass.

- [ ] **Step 4: Commit project IO**

Run:

```powershell
git add crates/studio-project
git commit -m "feat: add local project materialization"
```

Expected: commit contains local save/load helpers and tests.

## Task 5: Add Minimal Iced Timeline-First Shell

**Files:**
- Create/modify: `crates/studio-app/src/main.rs`
- Modify: `README.md`

- [ ] **Step 1: Implement app shell**

Build a minimal Iced app that:

- imports the bundled sample Babel fixture at startup
- renders a top transport strip with project name and segment count
- renders speaker lanes as timeline rows
- renders segment text rows beneath the lanes
- has no production edit behavior beyond display in this first UI slice

- [ ] **Step 2: Verify app compiles**

Run:

```powershell
cargo check -p studio-app
```

Expected: command exits `0`.

- [ ] **Step 3: Commit app shell**

Run:

```powershell
git add crates/studio-app README.md
git commit -m "feat: add native timeline shell"
```

Expected: commit contains the first native shell.

## Task 6: Full Verification

**Files:**
- No new files unless fixes are required.

- [ ] **Step 1: Run formatting**

Run:

```powershell
cargo fmt --all -- --check
```

Expected: command exits `0`.

- [ ] **Step 2: Run all tests**

Run:

```powershell
cargo test --workspace
```

Expected: all tests pass.

- [ ] **Step 3: Run full check**

Run:

```powershell
cargo check --workspace
```

Expected: all crates compile.

- [ ] **Step 4: Commit fixes if needed**

If verification required changes:

```powershell
git add .
git commit -m "chore: verify first transcription studio slice"
```

Expected: no uncommitted implementation changes remain.

## Self-Review

Spec coverage for this first slice:

- Standalone repo: Task 1.
- Rust workspace and crate boundaries: Task 1.
- Core model and typed commands: Task 2.
- Babel package import/export fixtures: Task 3.
- Local materialized project save/load: Task 4.
- Timeline-first Iced shell: Task 5.
- Verification: Task 6.

Known intentional gaps for later slices:

- Real audio playback, decoding, waveform rendering, silence scans, linter parity, plugin runtime, and packaging are not part of this first slice.
- The code boundaries are created so those features can be added without rewriting the editor core.

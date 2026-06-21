# Transcription Studio Design

Date: 2026-06-21

## Purpose

Transcription Studio is a standalone native desktop app for Babel-style transcription correction. It replaces the fragile web-dashboard-plus-extension workflow with a fast local editor that understands Babel primitives directly: audio tracks, speaker lanes, annotations, segment timing, transcript rows, lint state, and Babel-compatible export.

The first product milestone is the correction editor. Live Babel dashboard plumbing, review dashboards, and AI drafting/transcription are intentionally later. The hard interactive work should be solved first.

## Product Shape

Transcription Studio v1 targets Windows and macOS. The app is built in Rust with Iced, with a timeline-first workbench as the default UI.

The editor opens a Babel task package, materializes it into a local project, and lets the worker perform the full correction loop locally:

- inspect multi-speaker waveform lanes
- play, seek, zoom, and adjust speed
- edit segment text and timing
- create, split, merge, delete, and move segments
- run lint/autofix and text helpers
- use keyboard-first helper workflows
- save and export Babel-compatible output

The internal data model supports N speakers/audio lanes. The first UI is optimized for the real target workflow: one- or two-speaker Babel projects, especially two-speaker correction.

## Architecture

The repository should be a standalone `transcription-studio` Rust workspace, later added to the Babel aggregator as its own submodule.

Proposed crates:

- `studio-app`: Iced desktop shell, windows, panes, menus, hotkeys, command palette, settings, and project dialogs.
- `studio-core`: canonical editor model for projects, speakers, lanes, segments, selection, command history, undo/redo, and validation events.
- `studio-project`: local materialized project format, autosave, edit journal, recovery, folder/archive save and load.
- `studio-audio`: audio decoding, playback adapters, waveform peaks, resampling, silence scans, trim bounds, minimap and magnifier data.
- `studio-babel`: Babel package import/export adapters, package normalization, compatibility fixtures and round-trip tests.
- `studio-lint`: built-in Babel-style rule packs, autofixers, highlighted-word clearance, tag rules, spacing/punctuation rules, and SKAZ/text transforms.
- `studio-plugin`: stable plugin API for commands, lint rules, text transforms, import/export adapters, hotkey actions, and workflow actions.

The important boundary is that Iced renders state and dispatches commands; it does not own transcription logic. All meaningful edits go through typed editor commands, such as:

- `ApplyTextEdit`
- `MoveSegmentBoundary`
- `SplitSegment`
- `MergeSegments`
- `CreateSegment`
- `DeleteSegment`
- `ChangeSegmentSpeaker`
- `TrimSegmentToAudio`
- `AutoSegmentOnSilence`
- `MoveTextBetweenSegments`
- `ApplyLintFix`

This command model gives the app deterministic undo/redo, testable behavior outside the UI, plugin integration, and future room for other frontends if needed.

## V1 Feature Parity

V1 is full Babel correction parity plus the existing helper-extension workflow features. It is not a partial player/editor prototype.

Core Babel parity:

- Open Babel task packages containing audio tracks, speakers, annotations, text, timing metadata, and project/rule metadata.
- Show multi-lane waveform tracks with visible, solo, and mute controls.
- Provide transport controls: play/pause, jump, current time, playback speed, zoom, and track selection.
- Edit transcript rows with speaker, start time, end time, text, lint state, and actions.
- Edit segments by creating, deleting, splitting, merging, moving boundaries, and changing speaker lanes.
- Save local project state and export Babel-compatible task output.

Helper parity:

- Keyboard-first navigation and row actions.
- Focus and caret restore without moving playback.
- Playback-speed shortcuts and speaker workflow shortcuts.
- Text movement between adjacent segments.
- Timeline selection and cut-preview style workflows.
- Trim current segment and all visible segments to detected audio.
- Silence-based auto-segmentation, trimming, merging, silent-row cleanup, and text redistribution hooks.
- Minimap and edge-drag magnifier.
- Custom linter and autofix for current row or all rows.
- Highlighted-word warnings and clearance.
- Punctuation, spacing, tag, and language rules from the helper workflow.
- Quick tag/region autocomplete.
- Selected-number and SKAZ conversion helpers.
- Native hotkey/help UI equivalent to the helper extension's augmented shortcuts.

AI behavior is not included in v1. The architecture must still make AI plugins straightforward later by exposing selected rows, current segment, audio clips, proposed text patches, preview state, and command-based apply.

## Data And Package Model

The editor accepts Babel-shaped input packages, then immediately normalizes them into a durable local project.

Input packages may contain:

- annotation rows with stable row ids where available
- speaker keys and processed recording ids
- start and end seconds
- transcript text
- Babel metadata needed for round-trip export
- one or more audio tracks
- project preset or rule-pack identity
- optional source pointers or URLs for lightweight exports

The local materialized project should be self-contained after opening:

```text
project.json
segments.json
audio/
rules/
journal/
autosave/
```

`project.json` stores app version, source Babel metadata, speakers, lanes, source package identity, and export metadata.

`segments.json` stores normalized segment state with stable internal ids, source annotation ids, speaker/lane ids, start/end seconds, text, lint state, and per-segment metadata.

`audio/` stores cached track files or canonical decoded assets needed for reliable offline editing.

`rules/` stores a rule-pack snapshot when reproducibility requires it.

`journal/` and `autosave/` support crash recovery and edit history.

Segment identity must not depend on table position after import. Import can use speaker plus time range plus index as a fallback only when Babel does not provide stable ids.

## Plugin Model

Plugins are first-class, but v1 keeps the extension surface conservative.

V1 extension points:

- Commands: contribute command-palette actions and hotkey-bindable actions.
- Text transforms: implement SKAZ-like conversions, tag wrapping, cleanup, or custom formatting helpers.
- Lint rules and autofixers: add project-specific checks and fixes.
- Import/export adapters: support new package formats or Babel variants.
- Workflow actions: operate over selected/current segments through stable snapshots and typed commands.

Plugin rules:

- Plugins receive stable project or selection snapshots.
- Plugins propose commands or diagnostics.
- Plugins do not mutate editor internals directly.
- Internal Rust modules use the same conceptual boundaries as external plugins.
- External v1 plugins should be script/WASM-style where practical, sandboxed, and permissioned.
- Native Rust plugins can be a later power-user path.

No AI plugin ships in v1, but the API should make one obvious: read the selected/current rows, request audio clips, propose text or segment patches, preview the diff, then apply via editor commands.

## Implementation Strategy

Build in vertical slices while keeping full v1 parity as the product target.

1. Create the standalone Rust workspace and core crate boundaries.
2. Implement the core project model, segment model, command system, undo/redo, and unit tests.
3. Define local project format and Babel package fixtures.
4. Implement Babel import, materialization, save, recovery, and export round-trip tests.
5. Build the timeline-first Iced shell with loaded project state, rows, lanes, and selection.
6. Add audio decoding, playback, waveform peaks, zoom, and basic transport.
7. Implement segment/text commands in the UI: text edits, boundary moves, split, merge, delete, create, speaker changes.
8. Port the deterministic helper features: linter/autofix, text helpers, hotkeys, focus restore, text move, trim, silence segmentation, minimap, and magnifier.
9. Add the plugin API and bundled example plugins for lint rule, text transform, and import/export adapter.
10. Package for Windows and macOS.

## Verification Strategy

Core behavior should be tested outside the UI wherever possible.

Required test layers:

- `studio-core` command tests for every edit operation and undo/redo behavior.
- Babel import/export fixture tests, including round-trip preservation of source ids and timing/text metadata.
- Local project save/load and recovery tests.
- Audio scan and trim tests using synthetic audio fixtures.
- Linter and autofix tests ported from the existing helper rule behavior.
- Plugin API contract tests with example plugins.
- UI smoke tests where feasible, plus a manual correction-session checklist using a real Babel task package.

Compatibility should be enforced by fixtures and round-trip tests, not by prose alone.

## Risks And Constraints

- Iced may not provide every polished widget needed for dense audio editing. Keep the core model independent and isolate custom rendering/audio widgets behind app-layer boundaries.
- Cross-platform audio playback and waveform performance are core risks. `studio-audio` should hide playback backend choices from `studio-core`.
- Babel package shape may drift. Treat `studio-babel` as an adapter with compatibility fixtures, not as part of the editor core.
- Plugin power can become unsafe if exposed too early. Start with command, lint, transform, and import/export boundaries before deep mutation APIs.
- Live Babel sync and AI should wait until the local editor loop is reliable.

## Acceptance Criteria

- The first app screen is a timeline-first correction workbench.
- The app opens a Babel-shaped task package and materializes it locally.
- The local project can be saved, reopened, recovered after interruption, and exported.
- The core model supports N speakers while the UI is optimized for the one- and two-speaker Babel workflow.
- Full correction editing is represented as typed commands with undo/redo.
- Babel parity and helper parity are explicit v1 targets.
- No AI behavior is required for v1, but plugin boundaries make later AI features natural.
- The standalone repo can later be added to the Babel aggregator as a submodule.

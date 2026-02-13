# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Release automation workflow (`.github/workflows/release.yml`) for tag-driven publishing.
- Semver tag helper script (`scripts/release-version.sh`) with `patch`, `minor`, `major` bump modes.
- Workflow file export schema metadata (`schema`, `version`) with backward-compatible import checks.
- Workflow builder controls for undo/redo and explicit edge disconnect.
- Web recorder stop endpoint (`/api/recorders/web/stop`) and recorder navigation event capture.
- Recorder draft review panel with reorder/edit/skip controls before inserting recorded steps.
- Autopilot plan diagnostics: overall confidence score, node-level insights, and fallback template options.

### Changed
- CI now includes browser smoke validation (`Web E2E Smoke`).
- Web editor keyboard shortcuts now include undo/redo and selection-aware delete behavior.
- Web recorder now follows capture -> review -> insert flow instead of immediate node injection.
- Autopilot now requires explicit confirm-before-create flow and uses richer starter templates for vague prompts.

## [1.0.7] - 2026-02-13

### Fixed
- Playwright mining smoke test selector ambiguity (`Mining` vs `Refresh Mining`).

## [1.0.6] - 2026-02-13

### Added
- Playwright E2E smoke suite for login, workflow run, orchestrator queue/dispatch, and mining panel load.
- Deterministic web API mock harness for browser tests.
- CI job for browser smoke coverage.

## [1.0.5] - 2026-02-13

### Added
- GitHub Actions CI baseline for server/web test+build on PRs and pushes.
- CI status badge in README.

## [1.0.4] - 2026-02-13

### Added
- `CODE_OF_CONDUCT.md`.
- `LICENSE` (MIT).

## [1.0.3] - 2026-02-13

### Added
- Orchestrator APIs and UI with robot/job queue and dispatch sync.
- Process/task mining API and UI summary.
- Document understanding and clipboard AI runtime capabilities.
- Expanded contributor onboarding and demo documentation.

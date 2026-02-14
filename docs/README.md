# ForgeFlow Documentation

This folder contains the long-form technical documentation for operators and contributors.

## Contents

- [Architecture](./ARCHITECTURE.md): system components, data flow, storage model, reliability controls.
- [API Reference](./API_REFERENCE.md): complete HTTP and WebSocket endpoints with auth/permission requirements and examples.
- [Deployment Guide](./DEPLOYMENT.md): local/prod deployment steps, hardening checklist, and Kubernetes starter manifests.
- [Contributing Guide](./CONTRIBUTING.md): development setup, testing workflow, coding standards, and contribution process.
- [Demo Guide](./DEMOS.md): repeatable walkthroughs for product capability demos.
- [Starter Templates](../apps/server/src/lib/templates.ts): built-in production workflow baselines.
- [Activity Pack Roadmap](./ACTIVITY_PACK_ROADMAP.md): phased activity expansion and refactor/remove policy.
- [Contributor Onboarding](./ONBOARDING.md): fast path for first-time contributors.
- [First Automation Tutorial](./tutorials/FIRST_AUTOMATION_10_MIN.md): a 10-minute path from setup to successful test run.
- [Starter Workflow Example](./examples/workflows/first-automation.workflow.json): importable workflow file used in onboarding.
- [Contribution Templates](./templates): proposal/checklist/script templates for consistent PRs.
- [Changelog](../CHANGELOG.md): release history and upgrade notes.

Recent UX baseline:
- Quick-add node search in toolbar (`Ctrl/Cmd+K`) is a core workflow path and should remain covered in manual QA.
- Autopilot prompt-to-workflow flow is a core low-code path and should remain covered in manual QA.
- Orchestrator queue and process mining sidebar flows are core operations workflows and should remain covered in manual QA.

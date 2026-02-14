# Activity Pack Roadmap

This roadmap prioritizes activity expansion to keep ForgeFlow useful without adding low-value duplicate nodes.

## Phase Focus

- `phase-1` (Now): System/Core, Data Table, File & Folder, Interaction, Input/Output, Orchestrator basics.
- `phase-2` (Next): Excel, Mail, PDF/Word, Integration Service connectors, Document Understanding scopes, Database, FTP, Mobile, AI Center helpers.
- `phase-3` (Later): Terminal/Mainframe, Cryptography hardening, Apps builder expansion, advanced image analysis.

## Pack Coverage

- System/Core: `Assign`, `Delay`, `Do While`, `If`, `Switch`, `Parallel`, `For Each`, `Retry Scope`, `Trigger Scope`.
- Data Table: build/filter/sort/lookup/add-row/add-column/output.
- File & Folder: copy/create/delete/move/rename/append/path-exists.
- Interaction + I/O: application/browser scope, click/type/hover/state checks, clipboard, shortcuts, screenshots.
- Orchestrator: assets, queue transactions, attended/unattended triggers.
- Office/Docs: Excel, Mail, PDF, Word families.
- Integration Service: ServiceNow, Jira, Salesforce, Slack, Microsoft 365, Google Workspace.
- AI/DU/CV: document taxonomy + extraction scopes, summarize/translate/PII/categorize/sentiment/image-analysis, CV click/type/get-text.
- Infrastructure: Database, FTP, Terminal/Mainframe, Cryptography.

## Refactor and Remove Rules

Use these rules before adding new activities:

1. Prefer aliases over duplicates.
   Example: keep `set_variable` as runtime node; expose `Assign` as UX label/alias.
2. Keep one canonical action per behavior.
   Do not add multiple generic "Delete" nodes across packs; scope by domain (`file_delete`, `ftp_delete`).
3. Require a clear runtime owner.
   Every new activity must map to runner implementation, validation schema, and demo coverage.
4. Add packs, not isolated one-offs.
   New nodes should land in documented pack groups with phase and dependency notes.

## Definition of Done for New Activities

- Listed in `apps/server/src/lib/activities.ts` with `pack`, `phase`, `status`.
- Exposed in `/api/activities` and reflected in UI roadmap chips.
- Covered by validation + tests (`apps/server/src/lib/activities.test.ts`).
- Documented in `CHANGELOG.md` and demo/onboarding docs when user-visible.

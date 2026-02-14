# Node Implementation Checklist

Use this checklist in PRs that add or change workflow node behavior.

## Scope
- [ ] Node type and intent are clearly named.
- [ ] Inputs/outputs are documented.
- [ ] Backward compatibility impact is stated.

## Server Implementation
- [ ] Runner case added/updated (`apps/server/src/lib/runner.ts`).
- [ ] Validation rules updated where needed.
- [ ] Permission checks applied for protected operations.
- [ ] Audit events added for sensitive actions.

## Tests
- [ ] Success-path test added.
- [ ] Failure-path test added.
- [ ] Retry/timeout behavior tested when relevant.
- [ ] Existing tests still pass.

## Web/UI
- [ ] Node appears in catalog (`apps/web/src/lib/nodeCatalog.ts`) if user-facing.
- [ ] Inspector fields added/updated for node config.
- [ ] UX copy and defaults are clear.

## Documentation
- [ ] API/docs updated (`docs/API_REFERENCE.md` and related docs).
- [ ] Demo/onboarding docs updated if workflow changes are user-visible.
- [ ] Changelog updated.

## Definition of Done
- [ ] `cd apps/server && npm test && npm run build`
- [ ] `cd apps/web && npm test && npm run build`
- [ ] PR includes validation commands and rollback note.

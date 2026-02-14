# Activity Proposal Template

Use this when proposing a new built-in activity.

## Activity Metadata
- Activity ID: `example_activity`
- Label: `Example Activity`
- Category: `Web|Data|AI|Desktop|Integrations|Control`
- Status: `available|planned`
- Owner: `@username`

## Problem and User Outcome
- Problem this solves:
- Who benefits:
- Expected user-visible result:

## API/Runtime Contract
- Required inputs:
- Optional inputs:
- Output keys / side effects:
- Failure modes and retry strategy:

## Security and Governance
- Required permissions:
- Secrets handling:
- Audit event requirements:

## Example Node Data
```json
{
  "type": "example_activity",
  "label": "Example",
  "inputKey": "source",
  "outputKey": "result"
}
```

## Test Plan
- Unit tests to add:
- Edge/failure cases:
- Manual QA scenario:

## Documentation Updates
- [ ] `docs/API_REFERENCE.md`
- [ ] `docs/DEMOS.md` (if demoable)
- [ ] `README.md` / `docs/README.md` (if user-facing)

## Rollout/Risk Notes
- Backward compatibility:
- Rollback plan:

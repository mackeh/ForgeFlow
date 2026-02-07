# Security Policy

## Supported Versions

Security fixes are provided for the latest code line only.

| Version | Supported |
| ------- | --------- |
| `main` | Yes |
| Latest tagged release (`v1.x`) | Yes |
| Older tags/branches | No |

## Reporting a Vulnerability

Please do **not** open public GitHub issues for security vulnerabilities.

Use GitHub's private vulnerability reporting for this repository:
1. Go to the repository `Security` tab.
2. Open `Report a vulnerability`.
3. Include clear reproduction steps, affected components, impact, and suggested mitigation if available.

If private reporting is unavailable, contact the repository owner directly and include the same details.

## What to Include

- Affected version/commit (`git rev-parse --short HEAD` if possible)
- Environment details (OS, Docker version, browser, etc.)
- Steps to reproduce
- Proof-of-concept or logs/screenshots
- Impact assessment (confidentiality, integrity, availability)
- Any known workaround

## Response Targets

- Initial acknowledgment: within **72 hours**
- Triage decision: within **7 days**
- Status updates: at least every **7 days** while active

## Disclosure Process

- We follow coordinated disclosure.
- Please allow time for validation, fix development, and release before public disclosure.
- After a fix is released, we may publish a summary advisory and mitigation guidance.

## Scope Notes

In scope:
- Authentication/authorization bypass
- Secret leakage or encryption weaknesses
- Remote code execution
- SSRF, injection, path traversal, deserialization risks
- Workflow execution isolation failures

Out of scope (unless chained with security impact):
- Feature requests
- UI/UX bugs without security impact
- Self-host misconfiguration without product defect
- Denial of service requiring unrealistic local-only assumptions

## Safe Harbor

We support good-faith security research. If you act in good faith, avoid privacy violations and service disruption, and give us reasonable time to remediate, we will not pursue legal action for your research.

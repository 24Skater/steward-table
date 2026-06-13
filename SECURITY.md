# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| main    | Yes       |

We apply security fixes to the `main` branch and tag releases. Older pinned versions are not actively patched.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email **security@steward.app** with:

1. A description of the vulnerability and its potential impact
2. Steps to reproduce (proof-of-concept if available)
3. The affected component(s) and version/commit hash

You will receive an acknowledgment within 48 hours. We aim to release a fix within 14 days for critical issues and 30 days for high-severity issues, depending on complexity.

## Disclosure Process

1. You report the vulnerability privately to security@steward.app.
2. We confirm the issue and assess severity using CVSS v3.
3. We develop and test a fix on a private branch.
4. We coordinate a disclosure date with you (typically 14–30 days after report).
5. We release the fix and publish a GitHub Security Advisory.
6. Credit is given to the reporter unless anonymity is requested.

## Scope

The following are in scope:

- Authentication and session management
- RBAC / permission enforcement
- Multi-tenant data isolation (cross-church data leakage)
- Payment data handling (Stripe key storage, webhook verification)
- SQL injection and other injection vulnerabilities
- XSS and CSRF in the dashboard or storefront
- Insecure direct object references (IDOR)
- Sensitive data exposure (PII, encrypted keys)

The following are out of scope:

- Denial of service attacks
- Rate limiting on endpoints not handling sensitive data
- Vulnerabilities in third-party dependencies (report those upstream)
- Issues requiring physical access to a server

## Security Design Principles

- **Stripe keys** are stored AES-256-GCM encrypted in the database. The encryption key lives in the server environment, never in the DB.
- **Multi-tenancy** is enforced by a Prisma query extension that automatically scopes every query to `churchId`. Cross-tenant queries require an explicit bypass marker.
- **Passwords** are hashed with bcrypt (cost factor 12).
- **Sessions** use httpOnly, sameSite=lax, secure cookies via Auth.js.
- **Audit log** is append-only — every order, payment, and permission-deny event is recorded with actor, timestamp, and IP.

## Acknowledgments

We thank all security researchers who responsibly disclose vulnerabilities to us.

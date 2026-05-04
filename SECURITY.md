# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, **do not open a
public GitHub issue**. Public disclosure before a fix is in place puts all
users at risk.

Instead, report it privately by contacting the repository owner directly
through GitHub's private vulnerability reporting feature, or by reaching out
via the contact details on the repository profile.

Please include:

- A clear description of the vulnerability and its potential impact
- Steps to reproduce the issue (proof-of-concept, request/response samples,
  or a minimal reproduction case)
- The affected component, route, or file if known
- Any suggested remediation if you have one

You will receive an acknowledgement within **48 hours** and a resolution
update within **7 days**. Critical issues (authentication bypass, data
exposure, privilege escalation) are treated as highest priority and addressed
immediately.

---

## Scope

The following are considered in scope for security reports:

- Authentication and session handling (Supabase SSR, JWT verification,
  cookie management)
- Authorisation bypass — accessing routes or API endpoints without the
  required role
- Exposed sensitive data in API responses (user PII, tokens, internal
  identifiers)
- SQL injection or unsafe database queries via the Supabase client
- Cross-site scripting (XSS) in rendered content
- Cross-site request forgery (CSRF)
- Server-side request forgery (SSRF) in upload or URL-handling flows
- Insecure direct object references (IDOR) on event, registration, or user
  resources
- Privilege escalation via role-granting endpoints
- Secrets or credentials accidentally committed to the repository

The following are **out of scope**:

- Vulnerabilities in third-party services (Supabase, Vercel, Resend, Google
  OAuth) — report those to the respective vendor
- Denial-of-service attacks
- Issues that require physical access to a device
- Theoretical vulnerabilities with no demonstrated impact
- Rate-limiting or brute-force issues on non-sensitive endpoints

---

## Supported Versions

Only the latest version of the `main` branch is actively maintained. Security
fixes are not backported to older commits or branches.

---

## Security Practices in This Codebase

For contributors, the following security standards are enforced (see also
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)):

- All API keys, secrets, and environment-specific values must be stored in
  environment variables — never hardcoded in source
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed to
  the client
- All privileged API routes verify the Supabase JWT via the auth middleware
  before processing any request
- User-supplied URLs are validated by format only — no server-side fetching
  of external URLs (no SSRF)
- Error responses strip internal details (table names, column names,
  stack traces) before reaching the client
- CORS is enforced via an explicit allowlist in `server/index.js`

---

## Disclosure Policy

Once a reported vulnerability is confirmed and fixed, the repository owner
will coordinate disclosure timing with the reporter. Credit will be given to
the reporter in the release notes unless they prefer to remain anonymous.

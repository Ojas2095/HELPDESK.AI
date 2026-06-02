# Security Policy

## Supported Versions

The following versions of HELPDESK.AI are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

Please do **not** report security vulnerabilities through public GitHub issues.

Instead, please report them via email to `masteradmin@helpdesk.ai` (or your platform's designated security contact) or utilize GitHub's private vulnerability reporting feature.

We take all security vulnerabilities seriously. Once a vulnerability is submitted, we will:
1. Acknowledge receipt of your report within 48 hours.
2. Strive to send you regular updates about our progress in investigating and mitigating the issue.
3. Release a patch or advisory once the issue has been resolved.

Thank you for helping us keep HELPDESK.AI safe and secure for all users!

## Third-Party API Integration Security

Integrations with Supabase, Google GenAI, and other external services must follow these rules:

- Store API keys and service secrets in environment variables or a secrets manager. Do not hard-code credentials.
- Load secrets at startup and fail fast if required variables are missing.
- Do not log raw secrets, tokens, or full request/response payloads that may contain credentials.
- Use least-privilege access. Restrict database and AI clients to the minimum roles and scopes needed.
- Rotate keys regularly and revoke them immediately if a repository or environment is exposed.
- Keep third-party SDKs up to date and audit dependency advisories before merging integration changes.

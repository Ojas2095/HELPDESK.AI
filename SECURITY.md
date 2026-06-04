# Security Policy

## Supported Versions

The following versions of HELPDESK.AI are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

We strongly encourage all users to upgrade to the latest version to receive security updates.

## Reporting a Vulnerability

We take the security of HELPDESK.AI seriously. If you believe you have found a security vulnerability, please report it to us responsibly.

**Please do NOT report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, please report them via email to `masteradmin@helpdesk.ai` (or your platform's designated security contact) or utilize GitHub's private vulnerability reporting feature.

Please include as much of the following information as possible to help us better understand the nature and scope of the issue:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

We take all security vulnerabilities seriously. Once a vulnerability is submitted, we will:

1. Acknowledge receipt of your report within 48 hours
2. Strive to send you regular updates about our progress in investigating and mitigating the issue
3. Release a patch or advisory once the issue has been resolved

## Response Time

We will make every effort to respond to your report within the following timeframes:

| Severity    | Initial Response | Resolution Target |
| ----------- | ---------------- | ----------------- |
| Critical    | 24 hours         | 72 hours          |
| High        | 48 hours         | 7 days            |
| Medium      | 5 business days  | 30 days           |
| Low         | 10 business days | Next release      |

Resolution may include patching the vulnerability, providing a workaround, or documenting the issue.

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine the affected versions
2. Audit the code to find any similar problems
3. Prepare fixes for all supported versions
4. Release the fixes as soon as possible
5. Credit the reporter (with their permission)

## Security Best Practices

When using HELPDESK.AI, we recommend the following security best practices:

- **Keep updated**: Always use the latest version of HELPDESK.AI
- **Secure configuration**: Ensure all configuration files and environment variables are properly secured and not publicly accessible
- **Access control**: Use strong, unique passwords and enable two-factor authentication where available
- **Regular audits**: Periodically review user access and permissions
- **Network security**: Run HELPDESK.AI behind a properly configured firewall and use HTTPS for all connections
- **Dependency management**: Regularly update all dependencies to their latest secure versions
- **Backup**: Maintain regular backups of your data and configuration

## Security Updates

Security updates and advisories will be published through:

- GitHub releases
- Security advisories on the repository

## Acknowledgments

We appreciate the responsible disclosure of security vulnerabilities. We will publicly acknowledge those who report security issues (with permission).

Thank you for helping us keep HELPDESK.AI safe and secure for all users!

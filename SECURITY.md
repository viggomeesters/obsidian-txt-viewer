# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | Yes |

## Reporting a vulnerability

Please report security issues privately through GitHub security advisories or by contacting the repository owner.

Do not include private vault data in reports. Use a minimal synthetic `.txt` example when possible.

## Security model

TXT Viewer is a local, read-only file viewer:

- It reads `.txt` files through the vault API.
- It renders text inside the app.
- It does not write back to text files.
- It does not use runtime network APIs.
- It does not use clipboard APIs.
- It does not execute text content.

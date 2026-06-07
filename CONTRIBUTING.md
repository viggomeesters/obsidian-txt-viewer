# Contributing

Thanks for considering a contribution.

## Development

```bash
npm install
npm run build
npx tsc --noEmit
npm test
```

## Scope

TXT Viewer is read-only. Contributions should preserve these constraints:

- no text editing or write-back
- no clipboard access unless a future issue explicitly accepts that tradeoff
- no runtime network APIs
- no external service calls
- no broad file type registration beyond `.txt` without a focused design note

## Pull requests

Keep pull requests focused and include synthetic text fixtures for behavior changes. Do not include private vault content in tests, screenshots, or issues.

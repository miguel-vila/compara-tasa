---
name: add-bank-parser
description: Guide for adding a new bank parser to extract mortgage rates. Use when implementing parsers for BBVA, Caja Social, AV Villas, Itaú, or any new Colombian bank.
---

# Add Bank Parser

This skill guides you through adding a new bank parser to extract mortgage rates from HTML pages or PDF documents.

## When to Use

- Implementing a new bank's rate parser
- The bank has a public rate disclosure (HTML or PDF)
- The bank is listed in `BankId` enum or needs to be added

## Quick Steps

1. **Download fixture** to `fixtures/{bank_id}/`
2. **Analyze structure** - extract text from PDF or inspect HTML
3. **Implement parser** in `packages/updater/src/parsers/{bank_id}.ts`
4. **Register parser** in `packages/updater/src/parsers/index.ts`
5. **Write tests** in `packages/updater/src/parsers/{bank_id}.test.ts`
6. **Update PROGRESS.md**

## Key Files

- Parser interface: `packages/updater/src/parsers/types.ts`
- HTML example: `packages/updater/src/parsers/bancolombia.ts`
- PDF example: `packages/updater/src/parsers/scotiabank.ts`
- CloudFront WAF example: `packages/updater/src/parsers/banco-de-occidente.ts`
- Utilities: `packages/updater/src/utils/numbers.ts`

## Commands

```bash
# Run tests for a specific parser
pnpm --filter @compara-tasa/updater test -- --run {bank_id}

# Run all tests
pnpm --filter @compara-tasa/updater test -- --run

# Type check
pnpm typecheck

# Run the updater
pnpm --filter @compara-tasa/updater build && pnpm update-rates
```

## Detailed Instructions

Read `content.md` in this skill folder for:

- Fixture download commands
- PDF text extraction script
- Complete parser template
- Test template
- Rate type examples
- Utility function reference
- Common issues and solutions
- **CloudFront WAF bypass** using Playwright + stealth plugin

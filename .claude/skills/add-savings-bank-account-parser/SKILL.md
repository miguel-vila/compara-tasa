---
name: add-savings-bank-account-parser
description: Guide for adding a new bank parser to extract savings account rates. Use when implementing parsers for Lulo Bank, RappiPay, Pibank, Nu Colombia, or any new Colombian bank.
---

# Add Savings Account Parser

This skill guides you through adding a new bank parser to extract savings account rates from HTML pages.

## When to Use

- Implementing a new bank's savings account rate parser
- The bank has publicly disclosed savings rates (HTML page)
- The bank is listed in `BankId` enum or needs to be added

## Quick Steps

1. **Download fixture** to `fixtures/{bank_id}/savings-page.html`
2. **Analyze HTML structure** - inspect tables/divs containing rates
3. **Implement parser** in `packages/updater/src/parsers/savings/{bank_id}.ts`
4. **Register parser** in `packages/updater/src/parsers/savings/index.ts`
5. **Write tests** in `packages/updater/src/parsers/savings/{bank_id}.test.ts`
6. **Update PROGRESS-SAVINGS.md**

## Key Files

- Parser interface: `packages/updater/src/parsers/savings/types.ts`
- Example parser: `packages/updater/src/parsers/savings/ban100.ts`
- Core types: `packages/core/src/types.ts` (SavingsOffer, SavingsRate)
- Utilities: `packages/updater/src/utils/index.ts`

## Commands

```bash
# Run tests for a specific parser
pnpm --filter @compara-tasa/updater test -- --run savings/{bank_id}

# Run all savings tests
pnpm --filter @compara-tasa/updater test -- --run savings

# Type check
pnpm typecheck

# Run the savings updater
pnpm --filter @compara-tasa/updater build && pnpm update-savings
```

## Detailed Instructions

Read `content.md` in this skill folder for:

- Fixture download commands
- Complete parser template
- Test template
- Account type examples
- Utility function reference
- Common issues and solutions

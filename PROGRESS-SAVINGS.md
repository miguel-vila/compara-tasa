# Savings Account Support Progress

This document tracks the implementation of savings account rate comparison features.

## Status: MVP + 4 Banks

The savings account support is functional with five banks (Ban100, BBVA, Lulo Bank, RappiPay, and Pibank).

## Completed Tasks

### Phase 1: Core Types

- [x] Add `BAN100` to `BankId` enum
- [x] Add `Ban100` to `BankNames` map
- [x] Create `SavingsAccountType` enum (`STANDARD`, `HIGH_YIELD`, `DIGITAL`)
- [x] Create `BankSavingsUrls` map
- [x] Add `SavingsRate` type
- [x] Add `SavingsOffer` type
- [x] Add `SavingsOffersDataset` type
- [x] Add `BankSavingsParseResult` type
- [x] Add Zod schemas for all new types
- [x] Export all new types from `@compara-tasa/core`

### Phase 2: Updater

- [x] Create `BankSavingsParser` interface
- [x] Add `generateSavingsOfferId()` function
- [x] Download Ban100 fixture to `fixtures/ban100/savings-page.html`
- [x] Implement `Ban100Parser` using cheerio for HTML parsing
- [x] Create `createAllSavingsParsers()` factory
- [x] Write fixture-based tests (13 tests passing)
- [x] Create `update-savings.ts` entry point
- [x] Add `update-savings` script to package.json
- [x] **BBVA**: Implement PDF parsing (20 tests)
- [x] **Lulo Bank**: Implement Playwright + HTML parsing (12 tests)
- [x] **RappiPay**: Implement HTML parsing (12 tests)
- [x] **Pibank**: Implement PDF parsing (11 tests)

### Phase 3: Frontend

- [x] Add `fetchSavingsOffers()` function to `lib/data.ts`
- [x] Add `formatSavingsRate()` and `formatCopAmount()` functions
- [x] Create `SavingsRatesTable` component with TanStack React Table
- [x] Create `/ahorros` page route
- [x] Add "Cuentas de Ahorro" link to navigation header

## Running the Savings Pipeline

```bash
# Generate savings data
pnpm update-savings

# Run in development
pnpm --filter @compara-tasa/updater dev:savings
```

## BBVA Implementation Details

**Source URL:** https://www.bbva.com.co/content/dam/public-web/colombia/documents/personas/cuentas/ahorro/DO-01-Tasas-cuenta-ahorro.pdf

**Accounts Parsed:**

1. **Cuenta Especial Premium** (High Yield) - 7 tiered rates:
   - $1 - $4,999,999: 0.01% E.A.
   - $5,000,000 - $49,999,999: 3.00% E.A.
   - $50,000,000 - $199,999,999: 7.25% E.A.
   - $200,000,000 - $299,999,999: 7.75% E.A.
   - $300,000,000 - $499,000,000: 8.25% E.A.
   - $500,000,000 - $999,999,999: 8.75% E.A.
   - $1,000,000,000+: 9.25% E.A.

2. **Cuenta de Nómina y Digital** (Digital) - 1 rate:
   - All amounts: 0.01% E.A.

3. **Cuenta Blue** (Digital) - 1 rate:
   - All amounts: 0.01% E.A.

4. **Cuenta Blue Kids** (Standard) - 1 rate:
   - All amounts: 0.80% E.A.

5. **Cuenta Hogar** (Standard) - 5 tiered rates:
   - $1 - $500,000: 0.12% E.A.
   - $500,001 - $1,000,000: 0.50% E.A.
   - $1,000,001 - $10,000,000: 1.00% E.A.
   - $10,000,001 - $50,000,000: 1.50% E.A.
   - $50,000,001+: 1.60% E.A.

6. **AFC** (Standard, tax-advantaged housing) - 6 tiered rates:
   - $1 - $499,999: 1.40% E.A.
   - $500,000 - $5,000,000: 1.60% E.A.
   - $5,000,001 - $20,000,000: 2.00% E.A.
   - $20,000,001 - $50,000,000: 2.20% E.A.
   - $50,000,001 - $200,000,000: 2.50% E.A.
   - $200,000,001+: 3.00% E.A.

7. **Ahorro Fijo** (High Yield, fixed-term) - 1 rate:
   - Min $5,000,000, 360+ days: 10.00% E.A.

## Ban100 Implementation Details

**Source URL:** https://www.ban100.com.co/productos/cuenta-de-ahorro

**Accounts Parsed:**

1. **Cuenta de Ahorro 100pre** (High Yield) - 3 tiered rates:
   - $1 - $10,000,000: 6.50% E.A.
   - $10,000,001 - $30,000,000: 9.50% E.A.
   - $30,000,001+: 10.00% E.A.

2. **Cuenta de Ahorro Clásica** (Standard) - 1 rate:
   - All amounts from $1: 6.00% E.A.

## Lulo Bank Implementation Details

**Source URL:** https://ayuda.lulobank.com/hc/es/articles/28625884138772

**Scraping Method:** Playwright with stealth plugin (Cloudflare-protected Zendesk help center)

**Accounts Parsed:**

1. **Bolsillos Flex** (High Yield) - 2 rates:
   - Regular: 7.5% E.A.
   - Lulo Pro: 9.25% E.A.

2. **Bolsillos Programados** (High Yield) - 2 rates:
   - Regular: 9% E.A.
   - Lulo Pro: 10% E.A.

**Note:** Lulo Pro requires payroll deposit or income > $3,000,000/month.

## RappiPay Implementation Details

**Source URL:** https://www.rappipay.co/tasas-y-tarifas/

**Scraping Method:** HTML parsing with cheerio (static page with nested tabs)

**Accounts Parsed:**

1. **Bolsillos (Depósito de Bajo Monto)** (High Yield) - 1 rate:
   - 9% E.A.

2. **Bolsillos (Cuenta de Ahorros)** (High Yield) - 1 rate:
   - 9% E.A.

3. **Saldo Principal (Depósito de Bajo Monto)** (Standard) - 1 rate:
   - 0.1% E.A.

4. **Saldo Principal (Cuenta de Ahorros)** (Standard) - 1 rate:
   - 0.1% E.A.

**Notes:**

- RappiPay offers higher yields (9% E.A.) for money kept in "Bolsillos" (savings pockets)
- Money outside Bolsillos earns standard rate (0.1% E.A.)
- Bóvedas (fixed-term vaults at 9.25%-10% E.A.) are excluded as they function like CDTs, not savings accounts
- Page has nested tabs: outer (Personas/Empresas) and inner (monthly tariffs)

## Pibank Implementation Details

**Source URL:** https://www.pibank.co/uploads/2025/12/Tasas012026.pdf

**Scraping Method:** PDF parsing with pdfjs-dist

**Accounts Parsed:**

1. **Cuenta Pibank** (High Yield) - 1 rate:
   - All amounts from $1: 11% E.A.

**Notes:**

- Pibank (Banco Pichincha Colombia) offers a single savings account with no tiers
- Interests are calculated on daily balance and credited the first day of the following month
- PDF also contains CDT and credit rates, but only the savings account rate is extracted
- PDF text extraction quirk: rate appears as "1 1 %" with spaces between digits

## Next Banks to Add

Priority list from `savings-support.md`:

| Priority | Bank        | Scrapability         | URL             |
| -------- | ----------- | -------------------- | --------------- |
| Low      | Bancolombia | Poor (requires auth) | bancolombia.com |

## Blocked Banks (Not Implementable)

### Nu Colombia (Nubank)

**Status:** Cannot implement - no scrapeable rate source

**Investigation Date:** 2026-02-08

**Findings:**

- Main savings account rate (0.1% E.A.) is available at `/cf/cuenta-condiciones/`
- **Cajitas de ahorro rate (~8.75% E.A.) is NOT available in any scrapeable format:**
  - The conditions page shows "Estamos actualizando la tasa del mes, regresa en unos minutos para conocerla"
  - The official costs PDF (`nu_cuenta_costos_y_comisiones.pdf`) only links to "Encuéntrala aquí ↗" without the actual rate
  - Blog posts don't contain rates in static HTML
  - No dedicated rendimientos page exists (unlike Mexico's `nu.com.mx/cuenta/rendimientos/`)
- Current rates are only reported in news articles (El Colombiano, Valora Analitik), not official sources
- CDT rates are available in PDF (`CDT-Nu-VTUP.pdf`) but CDTs are not savings accounts

**Alternative:** If Nu Colombia adds their Cajitas rate to a scrapeable source in the future, implementation could be revisited.

## Future Enhancements

- [ ] Add savings-specific ranking scenarios (best overall rate, best for amount X)
- [x] Integrate savings stats on homepage (split stats section + savings preview section)
- [x] Add more banks (Pibank)

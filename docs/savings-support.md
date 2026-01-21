# Bank Savings Rates Support

Add support for comparing bank savings rates alongside mortgage rates.

Follow a similar approach but create new types, parsers, and UI components specific to savings products.

Create a new `PROGRESS-SAVINGS.md` file to track the work separately from mortgage-related progress.

## Bank info

Here's some info about the banks, a stable URL and some notes on scrapability:

| Bank                         | Current Rate          | Stable URL                                                | Format     | Scrapability  | Gotchas                                                                                             |
| ---------------------------- | --------------------- | --------------------------------------------------------- | ---------- | ------------- | --------------------------------------------------------------------------------------------------- |
| **Pibank** (Banco Pichincha) | 10% E.A.              | `https://www.pibank.co/cuenta-pibank/`                    | HTML       | ❌ **Poor**   | Returns 403 on direct fetch; requires browser/JS; rate mentioned in prose, not structured data      |
| **Ualá**                     | ~11-12% E.A.          | `https://www.uala.com.co/costos`                          | HTML       | ⚠️ **Medium** | Rate not on costs page; likely in app or dynamic content; no structured rate display                |
| **Nu Colombia**              | ~8.25% E.A. (cajitas) | `https://nu.com.co/cf/cuenta/`                            | HTML       | ⚠️ **Medium** | Rate not displayed on landing page; linked to T&C page; React SPA requires JS execution             |
| **Lulo Bank**                | 8% E.A. (bolsillos)   | `https://www.lulobank.com/`                               | Vue.js SPA | ❌ **Poor**   | Fully JS-rendered; help center (`ayuda.lulobank.com`) has rates in article text                     |
| **Lulo Bank Help**           | 8% E.A.               | `https://ayuda.lulobank.com/hc/es/articles/4403983414676` | HTML       | ✅ **Good**   | Plain HTML article; rate in text; stable Zendesk article ID                                         |
| **RappiPay**                 | 9% E.A. (bolsillos)   | `https://www.rappipay.co/rappicuenta/`                    | HTML       | ⚠️ **Medium** | Rate visible in HTML; WordPress site; rates scattered across page; 9% E.A. mentioned multiple times |
| **Ban100**                   | 6.5-10% E.A. (tiered) | `https://www.ban100.com.co/productos/cuenta-de-ahorro`    | HTML       | ✅ **Good**   | Rates in HTML table; tiered by amount; stable Drupal CMS                                            |

### Traditional Banks (Lower Rates, Less Relevant)

| Bank            | Rate       | URL                                                        | Scrapability | Notes                      |
| --------------- | ---------- | ---------------------------------------------------------- | ------------ | -------------------------- |
| Bancolombia     | 0.07% E.A. | Multiple pages                                             | ❌ Poor      | Complex site, rates buried |
| Banco de Bogotá | 0.16% E.A. | `https://www.bancodebogota.com/tasas-y-tarifas/tasas-2024` | ⚠️ Medium    | Monthly PDFs               |
| Davivienda      | 0.41% E.A. | N/A                                                        | ❌ Poor      | No single rate page        |
| BBVA            | 0.30% E.A. | N/A                                                        | ❌ Poor      | Rates in PDF tarifarios    |

### Priority Banks for Direct Scraping

| Priority | Bank      | Reason                          | Best URL                                                  |
| -------- | --------- | ------------------------------- | --------------------------------------------------------- |
| 1        | RappiPay  | High rate, decent HTML          | `https://www.rappipay.co/rappicuenta/`                    |
| 2        | Ban100    | Good HTML tables                | `https://www.ban100.com.co/productos/cuenta-de-ahorro`    |
| 3        | Lulo Bank | Popular, help articles stable   | `https://ayuda.lulobank.com/hc/es/articles/4403983414676` |
| 4        | Pibank    | High rate, but needs Playwright | `https://www.pibank.co/cuenta-pibank/` (403 on fetch)     |
| 5        | Ualá      | High rate, content in SPA       | Requires app/API reverse engineering                      |

## Summary

This document outlines the code changes needed to add **savings account** (cuentas de ahorro) rate comparison alongside the existing mortgage rates. Focus is on digital banks offering high-yield savings accounts—**CDTs are out of scope**.

## Already Done (Refactor 586b715)

The codebase was refactored to make room for savings by prefixing mortgage-specific types:

- `Offer` → `MortgageOffer`
- `ProductType` → `MortgageType`
- `ScenarioKey` → `MortgageScenarioKey`
- `BankParseResult` → `BankMortgageParseResult`
- `OffersDataset` → `MortgageOffersDataset`
- Route `/tasas` → `/hipotecario`
- Components renamed with `mortgage-` prefix

## Changes Needed

### 1. `packages/core` - New Types & Enums

```typescript
// New enums
SavingsAccountType = { STANDARD, DIGITAL, BOLSILLO }  // bolsillos = pockets/sub-accounts
SavingsScenarioKey = { BEST_SAVINGS_OVERALL, BEST_SAVINGS_DIGITAL }

// New types
SavingsRate = { ea_percent: number }  // always E.A. for savings accounts
SavingsOffer = {
  id, bank_id, bank_name,
  account_type: SavingsAccountType,
  min_amount_cop?: number,   // minimum balance for rate (tiered rates)
  rate: SavingsRate,
  channel: Channel,          // DIGITAL for neobanks
  conditions, source
}
BankSavingsParseResult = { bank_id, offers: SavingsOffer[], warnings, raw_text_hash }
SavingsOffersDataset = { generated_at, offers: SavingsOffer[] }
```

### 2. `packages/updater` - Parser Interface

```typescript
// New interface in parsers/types.ts
interface BankSavingsParser {
  bankId: BankId;
  sourceUrl: string;
  parse(): Promise<BankSavingsParseResult>;
}
```

- Create `parsers/savings/` directory for savings parsers
- Different banks than mortgages (neobanks vs traditional banks)
- Many require Playwright due to SPA/JS rendering
- New entry point: `pnpm update-savings-rates`

### 3. `packages/updater` - Rankings

- New `savingsRankings.ts` with simple scenario: highest E.A. rate wins
- Output to `savings-rankings-latest.json`

### 4. `apps/web` - Frontend

| File                                  | Change                                           |
| ------------------------------------- | ------------------------------------------------ |
| `app/ahorros/page.tsx`                | New route for savings comparison                 |
| `components/savings-rates-table.tsx`  | Table component for savings accounts             |
| `components/best-savings-section.tsx` | "Best savings rates" cards on homepage           |
| `lib/data.ts`                         | Add `getSavingsOffers()`, `getSavingsRankings()` |
| `app/layout.tsx`                      | Add nav link to `/ahorros`                       |

### 5. Data Files

New output files in `apps/web/public/data/`:

- `savings-offers-latest.json`
- `savings-rankings-latest.json`

## Scope Estimate

| Package | Files to Add/Modify                              |
| ------- | ------------------------------------------------ |
| core    | ~3 files (enums, types, schemas)                 |
| updater | ~8 files (interface + 5 bank parsers + rankings) |
| web     | ~5 files (route, components, data utils)         |

## Notes

- Target banks are different from mortgages (neobanks like RappiPay, Lulo, Pibank vs traditional banks)
- Most neobanks use SPAs requiring Playwright—plan for browser-based scraping from the start
- Savings rates are simpler than mortgages: single E.A. rate, no UVR/COP split, no VIS/NO_VIS segments
- Tiered rates (e.g., Ban100) can be represented as multiple offers with different `min_amount_cop`

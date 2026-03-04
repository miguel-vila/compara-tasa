# Commands

```bash
# Install dependencies and build
pnpm install
pnpm build                                # Build all packages (core, updater, web)
pnpm build:standalone                     # Build all + copy assets for Next.js standalone output

# Development
pnpm dev                              # Run Next.js dev server (localhost:3000)

# Run rate update ETL pipelines
pnpm update-mortgage-rates            # Scrapes banks for mortgage rates
pnpm update-savings-rates                   # Scrapes banks for savings account rates

# Testing
pnpm test                             # Run all tests
pnpm --filter @compara-tasa/updater test:watch  # Watch mode for updater tests

# Code quality
pnpm lint                             # ESLint
pnpm lint:fix                         # ESLint with auto-fix
pnpm format                           # Prettier
pnpm typecheck                        # TypeScript across all packages
```

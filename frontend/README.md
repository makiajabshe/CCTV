# Dashboard (React 19 + TypeScript)

```bash
cd frontend && yarn install
# .env: REACT_APP_BACKEND_URL=<backend origin>  (required)
#       REACT_APP_DASHBOARD_KEY=<value of backend DASHBOARD_READ_KEY, if set>
#       REACT_APP_STORE_ID=<uuid>  (optional default store)
yarn start        # dev server on :3000
yarn build        # production build in build/
CI=true yarn craco test --watchAll=false   # unit tests (src/**/*.test.ts)
```

Structure: `src/api` (contract types + fetch client), `src/lib/time.ts` (store-timezone helpers), `src/hooks` (polling), `src/components/dashboard`, `src/pages/Dashboard.tsx`. Shadcn primitives in `src/components/ui/*.jsx` are available via `allowJs`.

Rules: never render placeholder numbers; every value comes from `docs/CONTRACTS.md` endpoints. Times are shown in the store's IANA timezone.

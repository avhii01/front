# Relay operations dashboard

React 18 + TypeScript (strict) + Vite single-page dashboard for **Relay - AI Order Recovery Agent**.
Plain CSS, no UI or state libraries: hooks + `fetch` + polling.

All payment, inventory and shipping services behind the API are **simulated**. In *demo mode* the agent is
rule-based (no LLM); the header badge always shows which mode the backend is in.

## Run

```bash
cp .env.example .env     # VITE_API_URL=http://localhost:8000
npm install
npm run dev              # http://localhost:5173
```

The backend must allow the dashboard origin via CORS (default allows `http://localhost:5173`).

| Script              | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Vite dev server on port 5173          |
| `npm run build`     | Typecheck, then production build      |
| `npm run preview`   | Serve the built `dist/`               |
| `npm test`          | Vitest (watch); `npm test -- --run` once |
| `npm run typecheck` | `tsc --noEmit`                        |

## Docker

`VITE_API_URL` is baked in at build time (it is the URL the *browser* uses to reach the API):

```bash
docker build --build-arg VITE_API_URL=http://localhost:8000 -t relay-dashboard .
docker run --rm -p 8080:80 relay-dashboard
```

nginx serves `dist/` with an SPA fallback to `index.html`.

## Layout

- `src/api.ts`: typed API client (errors surface the backend `detail`); `src/types.ts` mirrors the backend.
- `src/hooks.ts`: `usePolling` (orders every 3 s, active runs every ~1 s) and `useLocalStorage` (operator name).
- `src/components/`: header, order queue, scenario injector, order workspace, service cards, run controls,
  tool timeline, decisions, approval panel, verification, outcome banner, metrics.

Free text from the backend (`workflow_error`, customer notes, memos, model rationales) is untrusted and is only
ever rendered as React text nodes, never as HTML.

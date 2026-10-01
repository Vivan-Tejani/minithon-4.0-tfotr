# M4 — Frontend Shell · Graph · Dashboard · Scenarios · Alerts · Demo

**You own:** everything under `frontend/` except the files listed as owned by M1, M2, M3 (`pages/Accounts.tsx`, `pages/Fixes.tsx`, `components/{AccountForm, PreviewCard, FiltersBar, AccountDetail, SpofPanel, CrownPath, BaselineCompare, FixCard}.tsx`). You own `src/api/*`, `src/components/{Graph, AlertsPanel, ui/*}`, `pages/{Dashboard, Scenarios}.tsx`, layout and routing.
**You provide to others:** project scaffold, `api/types.ts`, `api/client.ts`, mocks, UI primitives, the data hooks, the `Graph` component API.
**You need from others:** real endpoints as they land (see `00_INDEX_AND_DEPENDENCIES.md` handoffs).

## Agent prompt (paste with PRD.md)
> You are M4 on Chokepoint. You own the React + TypeScript frontend shell, the Cytoscape graph, the Dashboard, the Scenarios page and the Alerts panel. Follow PRD §5, §7 and §8 exactly; mirror §7 response shapes in `types.ts` and in the mocks. Everything must work with `VITE_USE_MOCK=true` first, then switch to the real API per endpoint as teammates announce it. Stack: Vite, React, TypeScript, Tailwind, TanStack Query, Cytoscape.js (used directly, no wrapper library), Recharts. No other UI libraries. Show likelihood as bands with exact percentages in tooltips, and always show the "model-based estimate" note.

---

## Phase 0 — Contracts (T+0:00 → 0:35)

### M4-00 · Scaffold, types, mocks, primitives — P0 · 25m  ⭐ unblocks all UI
**Depends on:** – · **Blocks:** every UI ticket
**Do:**
- `npm create vite@latest frontend -- --template react-ts`; add tailwind, `@tanstack/react-query`, `react-router-dom`, `cytoscape`, `recharts`.
- Routes: `/` Dashboard, `/accounts`, `/fixes`, `/scenarios`; top nav + bell icon (opens AlertsPanel); empty page shells that import the owner's component names so teammates can fill them without touching routing.
- `src/api/types.ts`: TypeScript mirrors of every PRD §5/§7 shape (`Account`, `Anchors`, `Settings`, `Analysis`, `Path`, `Fix`, `FixPlan`, `Preview`, `Scenario`, `ReviewItem`, `Snapshot`, `GraphView`).
- `src/api/client.ts`: `api.get/post/put/delete`; when `VITE_USE_MOCK=true` return JSON from `src/api/mocks/*.json`. A per-endpoint override map `{ analysis: false, fixes: false, … }` so each endpoint can flip to the real API independently.
- `src/api/mocks/`: one JSON per endpoint, hand-written with a 12-account persona-like dataset (use PRD §9 names, SIM swap ≈ 9 falls, believable `why` strings, a 6-point trend).
- UI primitives in `components/ui/`: `Card`, `Chip`, `BandBadge` (low/medium/high colours; tooltip shows exact % and "model-based estimate"), `Button`, `Drawer`, `Toast`, `Skeleton`, `Stat`.
- Agree on props for `Graph`, `SpofPanel`, `CrownPath` (see M4-02) in the group chat.
**Done when:** `npm run dev` shows all four routes on mocks; types and primitives are importable; teammates notified. **Announce at G0.**

---

## Phase 1 — Engines phase, UI on mocks (T+0:35 → 1:45)

### M4-01 · Dashboard — P0 · 35m
**Depends on:** M4-00 · **Blocks:** M2-08 (mount point)
**Do (`pages/Dashboard.tsx`):**
- Score gauge (0–100, colour by range: < 40 red, 40–69 amber, ≥ 70 green) with the `headline` sentence beneath it and the "model-based estimate" caveat.
- KPI row: total accounts, high-risk accounts, SPOF count, accounts reachable via SIM swap.
- "Riskiest accounts" top 5 (name, band badge, click → Account Detail drawer).
- Mount slots for `<SpofPanel/>` and `<CrownPath/>` (M2) and `<BaselineCompare/>` (M2, P1; hidden until it exists).
- Graph card using `<Graph/>` (M4-02), full width, with a legend and a "Fit" button.
- Trend chart (Recharts line) from `GET /snapshots`; each point labelled with the snapshot `label` in the tooltip; shows an empty state "Apply a fix to see your trend".
- Best-3 banner from `/fixes` (if available): "Do these 3 fixes → score 41 → 68" linking to `/fixes`.
**Done when:** renders from mocks, then from the real API when M1-05 and M3-07 land; no layout shift when data refreshes.

### M4-02 · Graph component — P0 · 45m  ⭐
**Depends on:** M4-00 · **Blocks:** M4-04, M4-06
**API (frozen at G0):**
```ts
<Graph view={GraphView} selectedId?={string} highlightIds?={string[]}
       onSelect={(id)=>void} ghost?={GraphView} height?={number} />
// imperative: ref.fit(), ref.focus(id)
```
**Do:** Cytoscape with `preset` layout computed by you: layer rows (0 entries/groups top, 1 hubs, 2 rest), x spread evenly per row with stable ordering by id. Node colour by band (low/medium/high), size by impact, shape by kind (entry = diamond, group = hexagon, account = round-rectangle). Edge labels visible on hover (and on selected node's edges); arrowheads; curved edges. `highlightIds` dims everything else. `ghost` nodes/edges render dashed with reduced opacity and a "new" badge. Click → `onSelect`. Tooltip on hover: name, band, exact %, impact. Legend component.
**Done when:** persona mock (≈ 17 nodes, ≈ 30 edges) is readable at 1280 px wide without overlapping labels; selecting from outside highlights the node; resizing does not break layout.
**Plan B:** if edge crossing is ugly, drop curved edges and show labels only for the selected node.

### M4-03 · Data layer — P0 · 20m
**Depends on:** M4-00 · **Blocks:** M1-06, M2-07, M3-08, M4-04, M4-05
**Do:** `src/api/hooks.ts` — TanStack Query hooks: `useState_`, `useAnalysis`, `useFixes`, `usePaths(id)`, `useSnapshots`, `useReview(asOf)`, `useEvents`, `useCatalog`; mutations `useUpsertAccount`, `useDeleteAccount`, `useApplyFix`, `usePreview` (mutation, no cache), `useScenario` (mutation), `useSeedDemo`. Every mutation invalidates `analysis`, `fixes`, `snapshots`, `review`, `state`. `SelectionContext` (selected account id; opens the Account Detail drawer globally). Global error toast; loading skeletons. "Load demo persona" and "Reset" buttons in the nav menu.
**Done when:** switching a mock flag to the real endpoint needs no component change.

---

## Phase 2 — Integrate (T+1:45 → 2:45)

### M4-04 · Scenarios page — P0 · 35m
**Depends on:** M3-05, M4-02, M4-03 · **Do (`pages/Scenarios.tsx`):**
- Scenario picker: kind tabs — "SIM swap", "Lost phone", "Service breached" (account select), "Account compromised" (account select). Run on change.
- Result: sentence ("A SIM swap would take over 9 accounts in 2 steps; score drops 41 → 5"), cascade list grouped by round with `via` labels, **hop slider** (0…max round) that drives `highlightIds` on the graph so accounts light up round by round, leaked password group chip (for breaches), `el_delta` and `score_during`.
- "What to do next": `next_actions` as compact fix cards with Apply buttons (reuse `FixCard` from M3 if available; otherwise a simple row).
**Done when:** SIM swap on the real API shows gmail in round 1 and canva in round 2 and the slider animates it; lost phone shows the "device lock holds" message when `falls = 0`.

### M4-05 · Alerts panel — P0 · 25m  (stealable)
**Depends on:** M3-03, M4-03 · **Do:** `AlertsPanel.tsx` (slide-over from the bell). Header: "Run review" and "Mark reviewed" buttons; item list grouped by severity; each item has title, one-line detail, "View account" link and a "Fix" button that applies or previews its `fix_id`. Badge count on the bell. **P1:** "+30 days" button calls `/review?as_of=` with the shifted date and shows the periodic-review item.
**Done when:** persona review shows stale accounts (hotmail, oldforum), weak 2FA, reuse; Fix buttons update the score.

### M4-06 · Ghost rendering in graph — P0 · 10m
**Depends on:** M4-02, M3-06 · **Do:** expose a `GhostContext` (`setGhost(view|null)`) consumed by every `<Graph/>`; clear on route change; make ghost edges visibly dashed. M1's `PreviewCard` calls `setGhost`.

---

## Phase 3 — Harden (T+2:45 → 3:20)

### M4-07 · Polish and empty states — P0 · 25m
**Depends on:** G2 · **Do:** loading skeletons everywhere; empty states (no accounts → "Load demo persona" CTA); error banners with retry; consistent copy; footer note "Model-based estimate, not a measured probability. Data stays on this device."; focus styles and keyboard-closable drawers; verify 1280×720 and 1440×900 layouts; no console errors/warnings on the 4 routes; favicon and page titles. Remove all mock-only code paths from the production build path (flags default to real API).
**Done when:** `npm run build` passes; walk the four routes on the real API with the persona.

---

## Phase 4 — Ship (T+3:20 → 4:00)

### M4-08 · Demo rehearsal + fallback recording — P0 · 20m
**Depends on:** G3 · **Do:** demo checklist (browser zoom, window size, persona preloaded, reset button works, second browser tab open on Scenarios); rehearse PRD §13 twice with a timer; record a 3-minute screen capture as a fallback (export as mp4); take 5 screenshots (dashboard, scenario cascade, fixes best-3, ghost preview, baseline compare if built) for the submission form. Drive the demo; M3/M2 narrate numbers.

---

## Plan B if blocked
- Real endpoint late: keep that endpoint's mock flag on; the UI stays demo-able.
- Graph looks messy: reduce to hubs + entries only with an "expand" toggle.
- Behind at G2: cut in this order — trend chart polish, KPI row, legend, hop slider animation (keep static highlight).

## Stealable by others
M4-05 (Alerts panel) → M1 or M3 if they finish first; M4-06 → M1.

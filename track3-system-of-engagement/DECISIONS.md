# DECISIONS.md

## Why Next.js 15

Next.js 15 App Router gives a stable production setup, excellent routing for `/dashboard` and `/session/[id]`, and good baseline performance defaults for Lighthouse goals.

## Why Zustand

The debrief flow requires lightweight local persistence across reloads until submit. Zustand with `persist` is small, explicit, and easy to reason about for form-like state.

## Why TanStack Query

Track 3 needs reliable loading, caching, retries, and explicit error states around API-first UX. TanStack Query handles this consistently across profile, metrics, and sessions.

## Why SVG Heatmap

The brief forbids off-the-shelf heatmap widgets. A custom SVG heatmap keeps render cost low, remains keyboard-accessible, and allows per-cell motion/interaction.

## SSE Reconnect Strategy

Coaching streaming uses fetch + stream parsing with reconnect delays of `1s -> 2s -> 4s -> 8s`, status messaging, manual retry, and clean abort handling.

## Accessibility Decisions

- Full keyboard navigation for stepper and segmented controls.
- Visible focus rings via `:focus-visible`.
- ARIA labels for heatmap cells and radiogroups.
- Semantic page landmarks and button semantics.

## Performance Decisions

- Dynamic import for Recharts.
- Narrow query scopes and stale caching via TanStack Query.
- Lightweight motion transitions and limited re-renders.
- Dark-first UI with simple gradients and no heavy media payloads.

## Mobile-First Strategy

Layouts start from `375px` single-column flow and progressively enhance to tablet/desktop grids. Core actions remain reachable without horizontal scrolling.

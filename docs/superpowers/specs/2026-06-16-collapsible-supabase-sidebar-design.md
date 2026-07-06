# Collapsible Supabase-style Sidebar + Chrome Reskin

**Date:** 2026-06-16
**Scope:** Treasury frontend shell chrome (Sidebar, Header, Footer) + adoption of existing design tokens.

## Goal

Replace the fixed 220px blue/slate `Sidebar` with a collapsible icon-rail sidebar,
refactored into a clean component architecture, styled to the Supabase emerald/monochrome
system already defined in `src/index.css` (`@theme`).

## Context / constraints

- Tailwind **v4** (`@tailwindcss/postcss`). Theme lives in the `@theme` block of
  `src/index.css`; the JS `tailwind.config.js` is **dead** (not referenced via `@config`).
- Token system already present: `--color-accent: #3ecf8e`, ink ladder (`--color-ink`,
  `-ink-mute`, `-ink-faint`), hairline ladder, `--color-canvas`, `--color-parchment`,
  radii 6/8/12px. Inter + JetBrains Mono loaded in `index.html`.
- Chrome currently ignores tokens, hardcoding the old palette (`#1d4ed8`, `#0f172a`,
  `#e2e8f0`, `#f8fafc`).
- Chrome renders only in standalone (`!embedded`) mode (`App.tsx`).

## Architecture

Replace `components/Sidebar.tsx` with a folder:

```
components/Sidebar/
├── index.tsx          # <aside> shell, composes pieces, owns layout/transition
├── navConfig.ts       # navGroups + bottomItems (typed NavItemDef[])
├── NavItem.tsx        # one nav button: active state, collapsed/tooltip
├── SidebarToggle.tsx  # pin/collapse chevron button
└── useSidebar.ts      # collapsed state + localStorage persist + search query
```

`App.tsx` import `./components/Sidebar` resolves to `Sidebar/index.tsx` unchanged.

Interfaces:
- `useSidebar(): { collapsed, toggle, query, setQuery }` — persists `collapsed` to
  `localStorage['treasury.sidebar.collapsed']`.
- `NavItem({ def, active, collapsed, onSelect })`.

## Collapse behavior

- States: **full ~220px** (icon + label + group headers + search) and **rail 56px**
  (centered icons only). Width animates `transition-[width] duration-200`.
- Chevron toggle pinned bottom-left; state persisted.
- Collapsed: group-label headers hide → thin `border-hairline` divider between groups;
  search input collapses to a search-icon button that expands the sidebar on click;
  each `NavItem` shows label as a hover tooltip.

## Visual system (token adoption — emerald used scarcely)

| Element | New |
|---|---|
| Sidebar bg | `bg-canvas` (white), `border-hairline` right border |
| Idle item | `text-ink-mute`, icon `text-ink-faint` |
| Idle hover | `hover:bg-parchment hover:text-ink` |
| Active item | `bg-parchment text-ink` + 2px emerald (`bg-accent`) left rail + emerald icon |
| Focus rings | `ring-accent/30`, `border-accent` |

Emerald appears only as active-item rail/icon accent and the live dot — never a flooded
background (per spec: one chromatic event, near-black on green). Header/Footer get the
same token swap; currency-toggle active pill stays white-on-ink.

## Out of scope

- Inner module views keep current styling (migrate to tokens later).
- Delete dead `tailwind.config.js` (unreferenced, contradicts live `@theme`).

## Verification

- `npm run build` (`tsc -b && vite build`) passes in `frontend/`.
- Manual: toggle collapse, reload (persists), rail tooltips, active rail accent renders.

# Centralized Auth Package Design

**Date:** 2026-06-25  
**Scope:** Extract Revenue's auth into `packages/auth` (`@grew/auth`); wire Treasury to use it.  
**Status:** Approved

---

## Problem

- **Revenue** has a mature, complete auth system (Supabase OTP + Google OAuth, whitelist check, per-user feature flags, polished Login UI).
- **Treasury** has no auth whatsoever — it loads without any session check.
- The target GrewAnalytics architecture (`CLAUDE.md`) calls for `Shared Packages > Auth` as a shell-level concern shared across all modules.
- Auth logic is currently duplicated between `shell-frontend/Auth.tsx` and Revenue, with Treasury having nothing.

---

## Solution

Create `packages/auth` (`@grew/auth`). Promote Revenue's auth logic into it. Update Revenue to re-export from the package (minimal diffs). Wire Treasury to use the same auth bootstrap pattern. All future modules pull from `@grew/auth`.

---

## Package Structure

```
packages/auth/
├── package.json          # name: @grew/auth, private: true
└── src/
    ├── index.ts          # barrel — re-exports all public API
    ├── supabaseClient.ts # single shared Supabase client (sessionStorage)
    ├── useAuthStore.ts   # Zustand store: auth state only
    ├── authService.ts    # verifyWhitelistAndSetUser
    └── Login.tsx         # Login UI: OTP + Google OAuth (ported from Revenue)
```

### `package.json`

```json
{
  "name": "@grew/auth",
  "private": true,
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@supabase/supabase-js": "^2.107.0",
    "zustand": "^5.0.3"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "lucide-react": "^0.400.0"
  }
}
```

---

## Auth State — `useAuthStore`

A dedicated Zustand store. Auth state only — no app routing, no UI state.

```ts
interface AuthState {
  isAuthenticated: boolean
  isBootstrapping: boolean
  user: { email: string; features: Record<string, boolean> } | null
  authError: string | null
  setAuthenticated(v: boolean): void
  setBootstrapping(v: boolean): void
  setUser(u: { email: string; features: Record<string, boolean> } | null): void
  setAuthError(e: string | null): void
}
```

`isBootstrapping` starts `true` and flips to `false` once the initial session check resolves. This prevents a flash of the login screen on page load.

---

## Auth Service — `authService.ts`

`verifyWhitelistAndSetUser(session, opts?)`:

1. Extract `email` from `session.user.email`. Return `{ ok: false }` if absent.
2. Optional 500 ms grace delay (for new-user Postgres trigger) unless `opts.skipDelay` is set.
3. Query `whitelist` table: `select('*').ilike('email', email).single()`.
4. On error/no row: call `supabase.auth.signOut()`, call `setAuthError(...)`, return `{ ok: false, errorMsg }`.
5. On success: extract every boolean column as per-user feature flags, call `useAuthStore.getState().setUser({ email, features })` and `setAuthenticated(true)`. Return `{ ok: true }`.

This is functionally identical to Revenue's current `authService.ts` — only the store import changes from `useStore` to `useAuthStore`.

---

## Login UI — `Login.tsx`

Ported verbatim from `apps/Revenue/apps/web/src/modules/shared/Login.tsx`. Only import paths change:

| Before | After |
|---|---|
| `@revenue/services/supabaseClient` | `./supabaseClient` |
| `@revenue/store/useStore` | `./useAuthStore` |

All UX is preserved: typewriter animation, OTP 8-digit input with auto-advance, Google OAuth, resend, error banners.

---

## Build Wiring — Vite Aliases

The `@grew/auth` alias must be added to every Vite config and tsconfig that compiles files importing it.

### `apps/shell-frontend/vite.config.ts`
```ts
'@grew/auth': path.resolve(__dirname, '../../packages/auth/src')
```

### `apps/shell-frontend/tsconfig.json`
```json
"@grew/auth/*": ["../../packages/auth/src/*"]
```

### `apps/Revenue/apps/web/vite.config.ts`
```ts
'@grew/auth': path.resolve(__dirname, '../../../../packages/auth/src')
```

### `apps/Revenue/apps/web/tsconfig.json`
```json
"@grew/auth/*": ["../../../../packages/auth/src/*"]
```

### `apps/Treasury/frontend/vite.config.ts`
```ts
'@grew/auth': path.resolve(__dirname, '../../../packages/auth/src')
```

### `apps/Treasury/frontend/tsconfig.json`
```json
"@grew/auth/*": ["../../../packages/auth/src/*"]
```

---

## Revenue Migration (minimal-diff)

Revenue's own files become thin re-exports. No logic is removed from Revenue — it simply delegates.

### `apps/Revenue/apps/web/src/services/supabaseClient.ts`
```ts
export { supabase } from '@grew/auth';
```

### `apps/Revenue/apps/web/src/services/authService.ts`
```ts
export { verifyWhitelistAndSetUser } from '@grew/auth';
export type { WhitelistResult } from '@grew/auth';
```

### `apps/Revenue/apps/web/src/modules/shared/Login.tsx`
```ts
export { Login } from '@grew/auth';
```

### `apps/Revenue/apps/web/src/App.tsx`

Replace auth-state destructuring from `useStore()` with `useAuthStore()`:

```ts
// Before
const { isAuthenticated, isBootstrapping, setBootstrapping, setAuthError, setUser, setAuthenticated, ... } = useStore();

// After
const { isAuthenticated, isBootstrapping, setBootstrapping, setAuthError, setUser, setAuthenticated } = useAuthStore();
const { activeApp, features, setFeatures, ui, updateUIState, activeMainView } = useStore();
```

Revenue's `useStore` auth fields (`isAuthenticated`, `isBootstrapping`, `user`, `authError`, their setters) are removed from `useStore.ts` after all Revenue components that read them are updated to import from `useAuthStore`.

---

## Treasury Integration

Treasury's `App.tsx` gets the same auth bootstrap pattern Revenue already uses.

```tsx
import { supabase, verifyWhitelistAndSetUser, useAuthStore, Login } from '@grew/auth'

const App: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { isAuthenticated, isBootstrapping, setBootstrapping, setAuthError, setUser, setAuthenticated } = useAuthStore()

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const result = await verifyWhitelistAndSetUser(session)
        if (!result.ok && result.errorMsg) setAuthError(result.errorMsg)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setAuthenticated(false)
      }
    })

    const boot = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const result = await verifyWhitelistAndSetUser(session, { skipDelay: true })
        if (!result.ok && result.errorMsg) setAuthError(result.errorMsg)
      }
      setBootstrapping(false)
    }

    boot()
    return () => authListener.subscription.unsubscribe()
  }, [])

  // When embedded in shell, shell handles auth — skip Treasury's own gate
  if (!embedded) {
    if (isBootstrapping) return <BootSpinner />
    if (!isAuthenticated) return <Login />
  }

  return ( /* existing Treasury JSX */ )
}
```

The `embedded` prop already exists on Treasury's `App.tsx`. Auth is skipped when `embedded = true` because the shell has already verified the session.

---

## Data Flow

```
User visits Treasury (standalone)
  → App boots → supabase.auth.getSession()
  → session exists? → verifyWhitelistAndSetUser()
      → whitelist table query
      → OK → useAuthStore.setUser() + setAuthenticated(true) → app renders
      → DENIED → signOut() + setAuthError() → <Login /> shown
  → no session → setBootstrapping(false) → <Login /> shown
      → user enters OTP / Google → onAuthStateChange('SIGNED_IN') fires
      → verifyWhitelistAndSetUser() → success → app renders
```

Same flow applies to Revenue standalone (already works; Revenue's wiring just delegates to `@grew/auth`).

---

## What Does NOT Change

- Shell-frontend's `Auth.tsx` — left as-is. Shell auth migration is a separate future task.
- Treasury's actual views and domain logic — untouched.
- Revenue's feature-flag system (`enable_auth`, `FeatureService`) — remains Revenue-specific; not pulled into `@grew/auth`.
- Supabase project, `whitelist` table, OTP config — no backend changes.

---

## Files Changed / Created

| Action | Path |
|---|---|
| CREATE | `packages/auth/package.json` |
| CREATE | `packages/auth/src/index.ts` |
| CREATE | `packages/auth/src/supabaseClient.ts` |
| CREATE | `packages/auth/src/useAuthStore.ts` |
| CREATE | `packages/auth/src/authService.ts` |
| CREATE | `packages/auth/src/Login.tsx` |
| EDIT | `apps/Revenue/apps/web/vite.config.ts` — add `@grew/auth` alias |
| EDIT | `apps/Revenue/apps/web/tsconfig.json` — add `@grew/auth` path |
| EDIT | `apps/Revenue/apps/web/src/services/supabaseClient.ts` — re-export |
| EDIT | `apps/Revenue/apps/web/src/services/authService.ts` — re-export |
| EDIT | `apps/Revenue/apps/web/src/modules/shared/Login.tsx` — re-export |
| EDIT | `apps/Revenue/apps/web/src/App.tsx` — use `useAuthStore` for auth state |
| EDIT | `apps/Revenue/apps/web/src/store/useStore.ts` — remove auth fields |
| EDIT | `apps/Treasury/frontend/vite.config.ts` — add `@grew/auth` alias |
| EDIT | `apps/Treasury/frontend/tsconfig.json` — add `@grew/auth` path |
| EDIT | `apps/Treasury/frontend/src/App.tsx` — add auth bootstrap + gate |
| EDIT | `apps/shell-frontend/vite.config.ts` — add `@grew/auth` alias |
| EDIT | `apps/shell-frontend/tsconfig.json` — add `@grew/auth` path |

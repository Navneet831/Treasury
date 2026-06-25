# Centralized Auth Package (`@grew/auth`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract Revenue's mature auth system into `packages/auth` (`@grew/auth`) and wire Treasury to use it, so both apps share one auth implementation.

**Architecture:** A new private package `packages/auth` holds the Supabase client, a dedicated Zustand auth store (`useAuthStore`), the whitelist verification service, and the Login UI. Revenue's auth files become thin re-exports. Treasury's `App.tsx` gains the same boot + gate pattern. Shell-frontend gets the alias for Docker builds.

**Tech Stack:** TypeScript, React 19, Zustand 5, `@supabase/supabase-js` 2.x, Vite aliases (no separate build step — package is compiled inline by each consuming app's Vite).

## Global Constraints

- All new files use TypeScript strict mode.
- The package has **no separate build step** — Vite compiles it from source via the `@grew/auth` alias.
- `@supabase/supabase-js` must be resolved from the **consuming app's** `node_modules` (not a shared copy), except in shell-frontend where it is force-aliased from shell's own `node_modules`.
- Treasury's env file lives at `apps/Treasury/.env` (one level above `frontend/`), loaded via `vite.config.ts`'s `loadEnv(mode, path.resolve(__dirname, '../'), '')`.
- Auth is **skipped** when Treasury's `App` receives `embedded={true}` — the shell has already verified the session.
- Revenue's `features` store (combined `enable_auth` + per-user whitelist flags) stays in Revenue's `useStore`. The package does not know about `enable_auth`.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| CREATE | `packages/auth/package.json` | Package manifest (`@grew/auth`) |
| CREATE | `packages/auth/src/supabaseClient.ts` | Single shared Supabase client |
| CREATE | `packages/auth/src/useAuthStore.ts` | Zustand auth-only store |
| CREATE | `packages/auth/src/authService.ts` | Whitelist verification |
| CREATE | `packages/auth/src/Login.tsx` | Login UI (OTP + Google OAuth) |
| CREATE | `packages/auth/src/index.ts` | Barrel export |
| EDIT | `apps/Revenue/apps/web/vite.config.ts` | Add `@grew/auth` alias |
| EDIT | `apps/Revenue/apps/web/tsconfig.json` | Add `@grew/auth` paths |
| EDIT | `apps/Revenue/apps/web/src/services/supabaseClient.ts` | Re-export from `@grew/auth` |
| EDIT | `apps/Revenue/apps/web/src/services/authService.ts` | Re-export from `@grew/auth` |
| EDIT | `apps/Revenue/apps/web/src/modules/shared/Login.tsx` | Re-export from `@grew/auth` |
| EDIT | `apps/Revenue/apps/web/src/App.tsx` | Use `useAuthStore` for auth state |
| EDIT | `apps/Revenue/apps/web/src/store/useStore.ts` | Remove auth fields |
| EDIT | `apps/Treasury/frontend/vite.config.ts` | Add `resolve.alias` + `@grew/auth` |
| EDIT | `apps/Treasury/frontend/tsconfig.app.json` | Add `paths` + `@grew/auth` |
| EDIT | `apps/Treasury/frontend/src/App.tsx` | Add auth bootstrap + gate |
| EDIT | `apps/shell-frontend/vite.config.ts` | Add `@grew/auth` alias |
| EDIT | `apps/shell-frontend/tsconfig.json` | Add `@grew/auth` paths + include |

---

## Task 1: Create `packages/auth` — Supabase client + auth store

**Files:**
- Create: `packages/auth/package.json`
- Create: `packages/auth/src/supabaseClient.ts`
- Create: `packages/auth/src/useAuthStore.ts`

**Interfaces:**
- Produces:
  - `supabase` — Supabase client instance
  - `useAuthStore()` — Zustand hook returning `AuthState`
  - `AuthState` interface (imported by authService and Login in later tasks)

---

- [ ] **Step 1: Create `packages/auth/package.json`**

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
    "lucide-react": "*"
  }
}
```

- [ ] **Step 2: Create `packages/auth/src/supabaseClient.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
        persistSession: true,
    },
});
```

- [ ] **Step 3: Create `packages/auth/src/useAuthStore.ts`**

```ts
import { create } from 'zustand';

export interface AuthUser {
    email: string;
    features: Record<string, boolean>;
}

export interface AuthState {
    isAuthenticated: boolean;
    isBootstrapping: boolean;
    user: AuthUser | null;
    authError: string | null;
    setAuthenticated: (v: boolean) => void;
    setBootstrapping: (v: boolean) => void;
    setUser: (u: AuthUser | null) => void;
    setAuthError: (e: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    isAuthenticated: false,
    isBootstrapping: true,
    user: null,
    authError: null,
    setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
    setBootstrapping: (isBootstrapping) => set({ isBootstrapping }),
    setUser: (user) => set({ user }),
    setAuthError: (authError) => set({ authError }),
}));
```

- [ ] **Step 4: Create stub `packages/auth/src/index.ts`** (barrel — will be completed in Task 3)

```ts
export { supabase } from './supabaseClient';
export { useAuthStore } from './useAuthStore';
export type { AuthUser, AuthState } from './useAuthStore';
```

- [ ] **Step 5: Commit**

```bash
cd D:/Development/GrewAnalytics/apps/Treasury
git add ../../packages/auth/
git status
```

> Note: if `packages/auth` is outside this git repo, commit from whichever git root contains it. If there is no enclosing repo, `git init` in `D:/Development/GrewAnalytics` and commit there. Otherwise use the Treasury repo if the path is tracked.

```bash
git commit -m "feat(auth): scaffold @grew/auth package — supabase client + auth store"
```

---

## Task 2: Add `authService.ts` to the package

**Files:**
- Create: `packages/auth/src/authService.ts`
- Modify: `packages/auth/src/index.ts` — add export

**Interfaces:**
- Consumes:
  - `supabase` from `./supabaseClient`
  - `useAuthStore` from `./useAuthStore`
- Produces:
  - `verifyWhitelistAndSetUser(session, opts?) → Promise<WhitelistResult>`
  - `WhitelistResult = { ok: boolean; errorMsg?: string }`

---

- [ ] **Step 1: Create `packages/auth/src/authService.ts`**

```ts
import { supabase } from './supabaseClient';
import { useAuthStore } from './useAuthStore';

export interface WhitelistResult {
    ok: boolean;
    errorMsg?: string;
}

export async function verifyWhitelistAndSetUser(
    session: { user?: { email?: string } } | null,
    opts?: { skipDelay?: boolean }
): Promise<WhitelistResult> {
    const email = session?.user?.email;
    if (!email) return { ok: false, errorMsg: 'No email in session.' };

    if (!opts?.skipDelay) {
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const { data, error } = await supabase
        .from('whitelist')
        .select('*')
        .ilike('email', email)
        .single();

    if (error || !data) {
        await supabase.auth.signOut();
        const msg = `ACCESS DENIED. The email address (${email}) could not be verified.`;
        useAuthStore.getState().setAuthError(msg);
        return { ok: false, errorMsg: msg };
    }

    const features: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(data)) {
        if (key !== 'email' && typeof value === 'boolean') {
            features[key] = value as boolean;
        }
    }

    const { setUser, setAuthenticated } = useAuthStore.getState();
    setUser({ email, features });
    setAuthenticated(true);
    return { ok: true };
}
```

- [ ] **Step 2: Update `packages/auth/src/index.ts`**

```ts
export { supabase } from './supabaseClient';
export { useAuthStore } from './useAuthStore';
export type { AuthUser, AuthState } from './useAuthStore';
export { verifyWhitelistAndSetUser } from './authService';
export type { WhitelistResult } from './authService';
```

- [ ] **Step 3: Commit**

```bash
git add ../../packages/auth/src/authService.ts ../../packages/auth/src/index.ts
git commit -m "feat(auth): add verifyWhitelistAndSetUser to @grew/auth"
```

---

## Task 3: Port `Login.tsx` into the package + complete barrel

**Files:**
- Create: `packages/auth/src/Login.tsx`
- Modify: `packages/auth/src/index.ts` — add `Login` export

**Interfaces:**
- Consumes:
  - `supabase` from `./supabaseClient`
  - `useAuthStore` from `./useAuthStore` (reads `authError`, `setAuthError`)
- Produces:
  - `Login` React component (no props required)

---

- [ ] **Step 1: Create `packages/auth/src/Login.tsx`**

This is a direct port of `apps/Revenue/apps/web/src/modules/shared/Login.tsx`. Copy that file verbatim, then change only the two import lines at the top:

```tsx
// REMOVE these two imports:
// import { useStore } from '@revenue/store/useStore';
// import { supabase } from '@revenue/services/supabaseClient';

// REPLACE with:
import { useAuthStore } from './useAuthStore';
import { supabase } from './supabaseClient';
```

Then replace the one destructure line that reads from the store:

```tsx
// REMOVE:
// const { authError, setAuthError } = useStore();

// REPLACE with:
const { authError, setAuthError } = useAuthStore();
```

The rest of the file (all 369 lines of JSX, handlers, typewriter animation, OTP logic, Google OAuth) remains **exactly as-is**. No other changes.

- [ ] **Step 2: Update `packages/auth/src/index.ts`** (final barrel)

```ts
export { supabase } from './supabaseClient';
export { useAuthStore } from './useAuthStore';
export type { AuthUser, AuthState } from './useAuthStore';
export { verifyWhitelistAndSetUser } from './authService';
export type { WhitelistResult } from './authService';
export { Login } from './Login';
```

- [ ] **Step 3: Verify the package compiles** (no build step — just check for obvious TS errors by reading the imports mentally; real verification comes in Task 4 when a consuming app builds against it)

- [ ] **Step 4: Commit**

```bash
git add ../../packages/auth/src/Login.tsx ../../packages/auth/src/index.ts
git commit -m "feat(auth): port Login UI into @grew/auth package"
```

---

## Task 4: Wire `@grew/auth` in Revenue + create thin re-exports

**Files:**
- Modify: `apps/Revenue/apps/web/vite.config.ts`
- Modify: `apps/Revenue/apps/web/tsconfig.json`
- Modify: `apps/Revenue/apps/web/src/services/supabaseClient.ts`
- Modify: `apps/Revenue/apps/web/src/services/authService.ts`
- Modify: `apps/Revenue/apps/web/src/modules/shared/Login.tsx`

**Interfaces:**
- Consumes: all exports from `@grew/auth` (Task 1–3)
- Produces: Revenue's existing internal paths still resolve (callers import from `@revenue/services/supabaseClient` etc. and get the same API)

---

- [ ] **Step 1: Add `@grew/auth` alias to `apps/Revenue/apps/web/vite.config.ts`**

In the `resolve.alias` object, add one entry after the existing entries:

```ts
resolve: {
    alias: {
        '@': path.resolve(__dirname, './src'),
        '@revenue/store': path.resolve(__dirname, './src/store'),
        '@revenue/services': path.resolve(__dirname, './src/services'),
        '@revenue/hooks': path.resolve(__dirname, './src/hooks'),
        '@revenue/assets': path.resolve(__dirname, './src/assets'),
        '@grew/auth': path.resolve(__dirname, '../../../../packages/auth/src'),
    },
},
```

- [ ] **Step 2: Add `@grew/auth` paths to `apps/Revenue/apps/web/tsconfig.json`**

Inside the `"paths"` object, add:

```json
"@grew/auth": ["../../../../packages/auth/src/index.ts"],
"@grew/auth/*": ["../../../../packages/auth/src/*"]
```

Also add `../../../../packages/auth/src` to the TypeScript include so the package source is type-checked:

```json
"include": ["src", "worker.js", "../../../../packages/auth/src/**/*.ts", "../../../../packages/auth/src/**/*.tsx"]
```

- [ ] **Step 3: Replace `apps/Revenue/apps/web/src/services/supabaseClient.ts`**

Replace the entire file content with:

```ts
export { supabase } from '@grew/auth';
```

- [ ] **Step 4: Replace `apps/Revenue/apps/web/src/services/authService.ts`**

Replace the entire file content with:

```ts
export { verifyWhitelistAndSetUser } from '@grew/auth';
export type { WhitelistResult } from '@grew/auth';
```

- [ ] **Step 5: Replace `apps/Revenue/apps/web/src/modules/shared/Login.tsx`**

Replace the entire file content with:

```tsx
export { Login } from '@grew/auth';
```

- [ ] **Step 6: Verify Revenue dev server still starts**

```bash
cd D:/Development/GrewAnalytics/apps/Revenue/apps/web
npm run dev
```

Expected: Vite dev server starts on port 5173. Open the browser — you should see the Login screen (since auth is not yet migrated in App.tsx). No "failed to resolve import" errors in the terminal.

- [ ] **Step 7: Commit**

```bash
cd D:/Development/GrewAnalytics/apps/Revenue
git add apps/web/vite.config.ts apps/web/tsconfig.json apps/web/src/services/supabaseClient.ts apps/web/src/services/authService.ts apps/web/src/modules/shared/Login.tsx
git commit -m "feat(auth): wire @grew/auth alias in Revenue + thin re-exports"
```

---

## Task 5: Migrate Revenue's `App.tsx` to `useAuthStore` + prune `useStore.ts`

**Files:**
- Modify: `apps/Revenue/apps/web/src/App.tsx`
- Modify: `apps/Revenue/apps/web/src/store/useStore.ts`

**Interfaces:**
- Consumes:
  - `useAuthStore, supabase, verifyWhitelistAndSetUser` from `@grew/auth`
  - `useStore` from `@revenue/store/useStore` (non-auth fields only)
- Produces: Revenue auth flow unchanged from the user's perspective

---

- [ ] **Step 1: Update imports in `apps/Revenue/apps/web/src/App.tsx`**

At the top of the file, add the `@grew/auth` import and remove the individual supabase/authService imports (they now come through `@grew/auth` indirectly via the re-exports, but App.tsx should import directly for clarity):

```tsx
// ADD this import (after existing imports):
import { supabase, verifyWhitelistAndSetUser, useAuthStore } from '@grew/auth';

// REMOVE these lines (they are now re-exports, but App.tsx should use @grew/auth directly):
// import { verifyWhitelistAndSetUser } from './services/authService';
// import { supabase } from './services/supabaseClient';
```

- [ ] **Step 2: Split the `useStore()` destructure in `App.tsx`**

Find the single `useStore()` call that destructures auth + app state together:

```tsx
const {
    updateUIState,
    activeApp,
    setFeatures,
    features,
    isAuthenticated,
    isBootstrapping,
    setBootstrapping,
    setAuthError,
    setUser,
    setAuthenticated,
    activeMainView,
    ui,
} = useStore();
```

Replace it with **two** separate calls:

```tsx
// Auth state from the shared package
const {
    isAuthenticated,
    isBootstrapping,
    setBootstrapping,
    setUser,
    setAuthenticated,
    user: authUser,
} = useAuthStore();

// App-specific state stays in Revenue's store
const {
    updateUIState,
    activeApp,
    setFeatures,
    features,
    activeMainView,
    ui,
} = useStore();
```

- [ ] **Step 3: Add a feature-sync effect in `App.tsx`**

Revenue combines platform-level `enable_auth` (fetched from the backend) with per-user whitelist features. After the two `useStore`/`useAuthStore` destructures, add:

```tsx
// Sync per-user whitelist features into Revenue's combined feature store
// whenever the authenticated user changes.
useEffect(() => {
    if (authUser?.features) {
        const { enable_auth } = useStore.getState().features;
        setFeatures({ enable_auth, ...authUser.features });
    }
}, [authUser, setFeatures]);
```

- [ ] **Step 4: Update the `onAuthStateChange` handler in `App.tsx`**

The handler currently calls `setUser(null)` and `setAuthenticated(false)` from `useStore`. These now come from `useAuthStore` (already destructured in Step 2):

```tsx
const { data: authListener } = supabase.auth.onAuthStateChange(
    async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            await verifyWhitelistAndSetUser(session);
            // State is updated inside verifyWhitelistAndSetUser via useAuthStore
        } else if (event === 'SIGNED_OUT') {
            setUser(null);        // useAuthStore's setUser
            setAuthenticated(false);  // useAuthStore's setAuthenticated
        }
    }
);
```

- [ ] **Step 5: Update the `boot()` function in `App.tsx`**

```tsx
const boot = async () => {
    const [flags, { data: { session } }] = await Promise.all([
        FeatureService.getFeatures(),
        supabase.auth.getSession(),
    ]);

    setFeatures(flags);  // useStore.setFeatures — sets enable_auth + any initial flags

    if (flags.enable_auth && session) {
        await verifyWhitelistAndSetUser(session, { skipDelay: true });
        // useAuthStore updated internally; feature-sync effect fires automatically
    }

    setBootstrapping(false);  // useAuthStore.setBootstrapping

    const loader = document.getElementById('app-boot-loader');
    if (loader) {
        setTimeout(() => {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }, 500);
    }
};
```

- [ ] **Step 6: Remove auth fields from `apps/Revenue/apps/web/src/store/useStore.ts`**

Before editing, run a quick search to confirm no other Revenue component reads these fields from `useStore`:

```bash
grep -r "useStore" D:/Development/GrewAnalytics/apps/Revenue/apps/web/src --include="*.tsx" --include="*.ts" -l
```

Then open each file found and confirm none of them destructure `isAuthenticated`, `isBootstrapping`, `user` (for auth), `authError`, `setUser`, `setAuthenticated`, `setBootstrapping`, `setAuthError` from `useStore`.

Once confirmed, remove from `AppState` interface (lines ~35–41 in current file):

```ts
// REMOVE these lines from the interface:
user: { name: string; features?: Record<string, boolean> } | null;
isAuthenticated: boolean;
isBootstrapping: boolean;
authError: string | null;

// REMOVE these action signatures:
setUser: (user: { name: string; features?: Record<string, boolean> } | null) => void;
setAuthenticated: (auth: boolean) => void;
setBootstrapping: (v: boolean) => void;
setAuthError: (msg: string | null) => void;
```

And remove the corresponding initial values and implementations from the `create<AppState>` call:

```ts
// REMOVE initial values:
user: null,
isAuthenticated: false,
isBootstrapping: true,
authError: null,

// REMOVE action implementations:
setUser: (user) => set({ user }),
setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
setBootstrapping: (isBootstrapping) => set({ isBootstrapping }),
setAuthError: (authError) => set({ authError }),
```

**Keep** `features` and `setFeatures` in `useStore` — Revenue uses them for the combined flag object.

- [ ] **Step 7: Verify Revenue full auth flow**

```bash
cd D:/Development/GrewAnalytics/apps/Revenue/apps/web
npm run dev
```

Open `http://localhost:5173`. Expected behavior:
1. Spinner appears briefly ("Establishing Secure Matrix…")
2. Login screen appears (OTP + Google OAuth)
3. Enter your whitelisted email → receive OTP → enter code → app loads
4. After sign-in, modules are accessible and per-user features apply

- [ ] **Step 8: Commit**

```bash
cd D:/Development/GrewAnalytics/apps/Revenue
git add apps/web/src/App.tsx apps/web/src/store/useStore.ts
git commit -m "feat(auth): migrate Revenue App.tsx to useAuthStore + prune useStore auth fields"
```

---

## Task 6: Wire Treasury + add auth bootstrap

**Files:**
- Modify: `apps/Treasury/frontend/package.json` — add `@supabase/supabase-js`
- Modify: `apps/Treasury/frontend/vite.config.ts` — add `resolve.alias`
- Modify: `apps/Treasury/frontend/tsconfig.app.json` — add `paths`
- Modify: `apps/Treasury/frontend/src/App.tsx` — add auth bootstrap + gate

**Interfaces:**
- Consumes: `supabase, verifyWhitelistAndSetUser, useAuthStore, Login` from `@grew/auth`

---

- [ ] **Step 1: Install `@supabase/supabase-js` in Treasury**

```bash
cd D:/Development/GrewAnalytics/apps/Treasury/frontend
npm install @supabase/supabase-js@^2.107.0
```

Expected: `package.json` gains `"@supabase/supabase-js": "^2.107.0"` in `dependencies`.

- [ ] **Step 2: Verify Treasury has Supabase env vars**

Check (or create) `apps/Treasury/.env`:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

These must match the values used by Revenue (same Supabase project, same `whitelist` table).

- [ ] **Step 3: Update `apps/Treasury/frontend/vite.config.ts`** — add `resolve.alias`

Replace the entire file content with:

```ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '../'), '')
  
  const host = env.FRONTEND_HOST || '127.0.0.1'
  const port = parseInt(env.FRONTEND_PORT || '8001', 10)

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@grew/auth': path.resolve(__dirname, '../../../packages/auth/src'),
      },
    },
    server: {
      host: host,
      port: port,
      strictPort: true,
    },
  }
})
```

- [ ] **Step 4: Update `apps/Treasury/frontend/tsconfig.app.json`** — add `paths` and `include`

Replace the entire file content with:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "types": ["vite/client"],
    "skipLibCheck": true,

    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,

    "paths": {
      "@grew/auth": ["../../../packages/auth/src/index.ts"],
      "@grew/auth/*": ["../../../packages/auth/src/*"]
    }
  },
  "include": [
    "src",
    "../../../packages/auth/src/**/*.ts",
    "../../../packages/auth/src/**/*.tsx"
  ]
}
```

- [ ] **Step 5: Update `apps/Treasury/frontend/src/App.tsx`** — add auth bootstrap

Add the auth imports at the top of the file:

```tsx
import { useEffect } from 'react'
import { supabase, verifyWhitelistAndSetUser, useAuthStore, Login } from '@grew/auth'
```

> Note: `useState` and `lazy` are already imported. Add `useEffect` to that same import if not already present. Keep all existing imports — just add these two new lines.

After the existing imports and before the `LEGACY_ALIASES` constant, add a simple boot-spinner component:

```tsx
const BootSpinner: React.FC = () => (
  <div className="h-screen w-full bg-[#05070A] flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-[3px] border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">
        Verifying Access…
      </p>
    </div>
  </div>
)
```

Inside the `App` component, add auth state + bootstrap effect **before** the `renderPage` function:

```tsx
const App: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [activePage, setActivePage] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const view = params.get('view') || 'limit'
    return LEGACY_ALIASES[view] || view
  })

  // ── Auth ────────────────────────────────────────────────────────────────────
  const {
    isAuthenticated,
    isBootstrapping,
    setBootstrapping,
    setUser,
    setAuthenticated,
  } = useAuthStore()

  useEffect(() => {
    if (embedded) {
      // Shell has already verified the session — skip Treasury's own gate
      setBootstrapping(false)
      return
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          await verifyWhitelistAndSetUser(session)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setAuthenticated(false)
        }
      }
    )

    const boot = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await verifyWhitelistAndSetUser(session, { skipDelay: true })
      }
      setBootstrapping(false)
    }

    boot()
    return () => authListener.subscription.unsubscribe()
  }, [embedded, setBootstrapping, setUser, setAuthenticated])
  // ────────────────────────────────────────────────────────────────────────────

  const renderPage = () => { /* existing switch — no changes */ }

  // Auth gate (standalone mode only)
  if (!embedded) {
    if (isBootstrapping) return <BootSpinner />
    if (!isAuthenticated) return <Login />
  }

  const isEmbedded = embedded

  return (
    <div className="min-h-screen bg-[#fafafa] pb-8">
      {/* existing JSX — no changes */}
    </div>
  )
}
```

- [ ] **Step 6: Verify Treasury standalone auth gate**

```bash
cd D:/Development/GrewAnalytics/apps/Treasury/frontend
npm run dev
```

Open `http://127.0.0.1:8001`. Expected:
1. Spinner appears ("Verifying Access…")
2. Login screen appears (same UI as Revenue — OTP + Google OAuth)
3. Enter a whitelisted email → receive OTP → enter 8-digit code → Treasury app loads
4. Refreshing the page: spinner → instant login (session stored in sessionStorage)
5. Closing the browser tab and reopening: spinner → Login screen (sessionStorage cleared)

- [ ] **Step 7: Commit**

```bash
cd D:/Development/GrewAnalytics/apps/Treasury
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/tsconfig.app.json frontend/src/App.tsx
git commit -m "feat(auth): add @grew/auth gate to Treasury standalone app"
```

---

## Task 7: Wire `@grew/auth` alias in shell-frontend

This task ensures Docker builds (where sub-app `node_modules` are excluded) can still resolve `@grew/auth` imports from Treasury and Revenue source trees.

**Files:**
- Modify: `apps/shell-frontend/vite.config.ts`
- Modify: `apps/shell-frontend/tsconfig.json`

---

- [ ] **Step 1: Add `@grew/auth` alias to `apps/shell-frontend/vite.config.ts`**

Inside the `resolve.alias` object, add after the `@grew/shared` entry:

```ts
'@grew/auth': path.resolve(__dirname, '../../packages/auth/src'),
```

Full alias block after the change:

```ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@revenue': path.resolve(__dirname, '../Revenue/apps/web/src'),
    '@revenue/shared': path.resolve(__dirname, '../Revenue/apps/web/src/shared'),
    '@treasury': path.resolve(__dirname, '../Treasury/frontend/src'),
    '@grew/ui': path.resolve(__dirname, '../../packages/ui/src'),
    '@grew/shared': path.resolve(__dirname, '../../packages/shared/src'),
    '@grew/auth': path.resolve(__dirname, '../../packages/auth/src'),
    // force single copies for Docker (sub-app node_modules excluded)
    'lucide-react': path.resolve(__dirname, './node_modules/lucide-react'),
    'recharts': path.resolve(__dirname, './node_modules/recharts'),
    'react': path.resolve(__dirname, './node_modules/react'),
    'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    'axios': path.resolve(__dirname, './node_modules/axios'),
    'ag-grid-community': path.resolve(__dirname, './node_modules/ag-grid-community'),
    'ag-grid-react': path.resolve(__dirname, './node_modules/ag-grid-react'),
    'zustand': path.resolve(__dirname, './node_modules/zustand'),
    '@supabase/supabase-js': path.resolve(__dirname, './node_modules/@supabase/supabase-js'),
  },
},
```

- [ ] **Step 2: Add `@grew/auth` paths to `apps/shell-frontend/tsconfig.json`**

Inside the `"paths"` object, add:

```json
"@grew/auth": ["../../packages/auth/src/index.ts"],
"@grew/auth/*": ["../../packages/auth/src/*"]
```

Also add the package source to the `"include"` array:

```json
"../../packages/auth/src/**/*.ts",
"../../packages/auth/src/**/*.tsx"
```

- [ ] **Step 3: Verify shell-frontend dev build**

```bash
cd D:/Development/GrewAnalytics/apps/shell-frontend
npm run dev
```

Open `http://localhost:5173`. Expected:
1. Shell loads with the shell's own `Auth.tsx` gating (unchanged).
2. Navigate to the Treasury module tab — Treasury renders without errors (uses shell auth, `embedded={true}` skips Treasury's own gate).
3. No "failed to resolve import `@grew/auth`" errors in the terminal.

- [ ] **Step 4: Commit**

```bash
cd D:/Development/GrewAnalytics/apps/Treasury
git add ../../apps/shell-frontend/vite.config.ts ../../apps/shell-frontend/tsconfig.json
git commit -m "feat(auth): add @grew/auth alias to shell-frontend build"
```

> Note: if shell-frontend is in its own git repo, commit from that repo's root instead.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| `packages/auth` with 5 files | Tasks 1–3 |
| `supabaseClient.ts` — sessionStorage, persistSession | Task 1 Step 2 |
| `useAuthStore` with 4 state fields + 4 actions | Task 1 Step 3 |
| `verifyWhitelistAndSetUser` — whitelist query, boolean columns as flags | Task 2 Step 1 |
| `Login.tsx` ported from Revenue with import-only changes | Task 3 Step 1 |
| `index.ts` barrel | Task 3 Step 2 |
| Revenue: 3 files become thin re-exports | Task 4 Steps 3–5 |
| Revenue: `App.tsx` reads auth state from `useAuthStore` | Task 5 Steps 2–5 |
| Revenue: `useStore.ts` auth fields removed | Task 5 Step 6 |
| Treasury: `@supabase/supabase-js` installed | Task 6 Step 1 |
| Treasury: Vite alias + tsconfig paths | Task 6 Steps 3–4 |
| Treasury: auth bootstrap in `App.tsx` | Task 6 Step 5 |
| Treasury: `embedded=true` skips auth gate | Task 6 Step 5 (embedded guard) |
| shell-frontend alias | Task 7 |
| shell's own `Auth.tsx` unchanged | Not touched in any task ✓ |
| Revenue `enable_auth` feature flag unaffected | Task 5 Step 3 (sync effect) |

**No placeholders found.**

**Type consistency check:**

- `AuthUser` defined in Task 1 (`{ email: string; features: Record<string, boolean> }`) — used identically in Task 2 (`setUser({ email, features })`) and Task 5 (`authUser?.features`). ✓
- `verifyWhitelistAndSetUser` signature defined in Task 2 — called identically in Tasks 5 and 6. ✓
- `WhitelistResult` exported from Task 2 — re-exported in Task 4. ✓
- `useAuthStore` destructures (`isAuthenticated`, `isBootstrapping`, `setBootstrapping`, `setUser`, `setAuthenticated`) consistent across Tasks 5 and 6. ✓

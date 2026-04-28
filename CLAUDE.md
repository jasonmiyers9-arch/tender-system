# tender-system

Next.js (App Router) frontend in `frontend/`. Deployed to Netlify project **tender-gaurd-pro** (team: Tender Guard Pro, site id `b992d0f6-773d-4540-8bff-842ce3da13d1`).

- Prod URL: https://tender-gaurd-pro.netlify.app
- Repo connected on Netlify: https://github.com/jasonmiyers9-arch/tender-system

## Commit conventions

- Do NOT add `Co-Authored-By: Claude ...` trailers or any Claude attribution lines in commit messages or PR bodies.
- Do NOT include `🤖 Generated with [Claude Code]` footers.
- Plain commit messages only — author is the human committer.

## Deploy

Always use the combined build+deploy command — splitting build and deploy ships a broken bundle (see "CSS missing" below).

```bash
netlify deploy --build --prod
```

If a previous run failed mid-way, clean stale plugin state first:

```bash
rm -rf frontend/.netlify frontend/.next
netlify deploy --build --prod
```

## netlify.toml — final working config

```toml
[build]
  base = "frontend"
  command = "npm install && npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

`publish` MUST be `.next` (NOT `frontend/.next`) when using combined `--build --prod`. See gotcha #1.

## Deploy gotchas (learned the hard way)

### 1. `publish` path semantics differ between modes

- `netlify deploy --build --prod` resolves `publish` **relative to `base`** → use `.next`
- `netlify deploy --no-build` resolves `publish` **relative to project root** → would need `frontend/.next`

Stay on combined mode. Mixing the two flips the path resolution and breaks builds with either "publish dir not found" or `frontend/frontend/.next`.

### 2. `--no-build` ships a broken site (no CSS)

`@netlify/plugin-nextjs` swaps `.next` ↔ `.netlify/static` only during `onPostBuild` and reverts in `unpublishStaticDir` after upload. Splitting `netlify build` + `netlify deploy --no-build` deploys the raw `.next` (server files only) — `_next/static/chunks/*.css` and JS chunks are absent. Symptom: site loads, renders black-on-black.

Fix: always use single-pass `netlify deploy --build --prod`.

### 3. `Failed publishing static content` on `onPostBuild`

Plugin can't `rename(.next, .netlify/.next)` if stale dirs from a previous failed run exist. Mitigation:

```bash
rm -rf frontend/.netlify frontend/.next
```

OneDrive sync of the project dir can also briefly lock files mid-rename.

### 4. Transient `403 fetching extensions`

Combined runs sometimes hit `Failed retrieving extensions for site <id>: 403`. Re-run usually works. If persistent, run `netlify status` to confirm auth, or fall back to a fresh `netlify build` once to prime cache.

### 5. Turbopack `serverExternalPackages` broken on Netlify Functions

Next 16 builds with Turbopack by default. Server chunks reference externals via a hashed name (e.g. `firebase-admin-a14c8a5423a75469`) that doesn't exist in the deployed `node_modules`. Symptom: every `/api/*` route returns 500, function logs show `Cannot find module 'firebase-admin-<hash>'`.

Adding the package to `serverExternalPackages` in `next.config.ts` does NOT fix it.

Fix: build with webpack instead.

```json
// frontend/package.json
"build": "next build --webpack"
```

### 6. Stale link after site delete

If the linked site is deleted, `.netlify/state.json` keeps the dead UUID. Fix:

```bash
netlify unlink
netlify link --id <new-site-uuid>
```

## Site management

List: `netlify sites:list`
Delete: `netlify sites:delete <site-id> --force`

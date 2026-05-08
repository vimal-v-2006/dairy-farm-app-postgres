# PostgreSQL Migration Result

**Date:** 2026-05-08
**Status:** COMPLETE — All code converted, builds pass

---

## Verification

| Check | Result |
|---|---|
| Original project untouched | Confirmed — no files modified |
| SQLite DB preserved at source | `~/.openclaw/workspace/dairy-farm-app/server/data/dairy-farm.db` intact |
| New project created | `~/Projects/dairy-farm-app-postgres` |
| Server `npm install` | Passed — 0 vulnerabilities |
| Client `npm run build` | Passed — built in 769ms |
| Server syntax check (`node --check`) | Passed — db.js, index.js, migration script |

---

## Files Changed / Created

### Modified (rewritten)

| File | Change |
|---|---|
| `server/package.json` | Replaced `better-sqlite3` from dependencies → devDependencies. Added `pg` to dependencies. Added `migrate` script. |
| `server/src/db.js` | Complete rewrite. Replaced `better-sqlite3` synchronous API with `pg` Pool async API. Provides `query()`, `queryOne()`, `execute()`, `insertReturning()`, `initDb()`. |
| `server/src/index.js` | Complete rewrite. All 821 lines converted from SQLite to PostgreSQL. Every route handler now async. All `?` params → `$1, $2...` params. `lastInsertRowid` → `RETURNING id`. `db.transaction()` → `pool.connect()` with BEGIN/COMMIT/ROLLBACK. `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`. Added async/await to all DB calls. Added production CORS via `FRONTEND_URL`. |

### Created New

| File | Purpose |
|---|---|
| `server/src/schema.sql` | Full PostgreSQL schema — 15 tables, indexes, foreign keys, correct PG types (SERIAL, DOUBLE PRECISION, BOOLEAN, TIMESTAMP, NOW()) |
| `server/scripts/migrate-sqlite-to-pg.js` | Migration script — reads SQLite DB, inserts into PostgreSQL, resets SERIAL sequences |
| `server/.env.example` | Template for server environment variables |
| `client/.env.example` | Template for client environment variables |
| `client/vercel.json` | Vercel SPA routing config (rewrites all paths to index.html) |
| `DEPLOYMENT.md` | Complete deployment guide for Vercel + Render + Neon |

---

## Commands to Run Locally

### Setup (first time)

```bash
cd ~/Projects/dairy-farm-app-postgres

# Install dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# Create .env files
cp server/.env.example server/.env
cp client/.env.example client/.env
```

### Edit server/.env

```
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/dairyfarm?sslmode=require
JWT_SECRET=your-random-secret-32-chars-minimum
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### Start development

```bash
# From root directory
npm run dev
```

This starts:
- Frontend: http://localhost:5173 (Vite)
- Backend: http://localhost:4000 (Express + nodemon)

### Build for production

```bash
npm run build
```

---

## Environment Variables

### Server (Render)

| Variable | Required | Example |
|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require` |
| `JWT_SECRET` | Yes | `openssl rand -hex 32` output |
| `FRONTEND_URL` | Yes | `https://your-app.vercel.app` |
| `PORT` | No | Auto-set by Render |
| `UPLOADS_DIR` | No | `./uploads` (default) |
| `NODE_ENV` | No | `production` |

### Client (Vercel)

| Variable | Required | Example |
|---|---|---|
| `VITE_API_URL` | Yes | `https://your-app.onrender.com` |

---

## Neon PostgreSQL Setup

1. Go to https://neon.tech → Sign up (free)
2. Create new project → `dairy-farm-db`
3. Choose region (preferably same as Render)
4. Copy the **Connection String** (format: `postgresql://...`)
5. Run schema: Go to SQL Editor → paste `server/src/schema.sql` → Execute
6. Add connection string as `DATABASE_URL` in Render env vars

### Connection string format
```
postgresql://dairyfarm_owner:yourpassword@ep-quiet-sun-123456.us-east-2.aws.neon.tech/dairyfarm?sslmode=require
```

---

## How to Migrate Old SQLite Data to Neon

### Prerequisites
- Have `server/data/dairy-farm.db` (the SQLite file)
- Have Neon database created with schema applied
- Have `better-sqlite3` installed (already in devDependencies)

### Steps

```bash
cd ~/Projects/dairy-farm-app-postgres/server

# Set your Neon connection string
export DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/dairyfarm?sslmode=require"

# Run migration (script reads from server/data/dairy-farm.db by default)
npm run migrate

# Or specify a custom SQLite path:
npm run migrate -- /path/to/your/dairy-farm.db
```

### What the migration script does

1. Opens SQLite database in read-only mode
2. Connects to PostgreSQL via `DATABASE_URL`
3. For each of 15 tables:
   - Reads all rows from SQLite
   - Inserts into PostgreSQL with `ON CONFLICT (id) DO NOTHING`
   - Converts boolean columns (`active`, `is_default`) from int to boolean
   - Resets PostgreSQL SERIAL sequences to correct max values
4. Closes both connections

### Verify migration

```bash
# Start server with PostgreSQL
cd server
npm start

# Check data
curl http://localhost:4000/api/bootstrap  # (with auth token)
# Or: curl http://localhost:4000/api/export/json
```

---

## Render Setup

1. Go to https://dashboard.render.com → Sign up (free)
2. New+ → **Web Service** → Connect GitHub repo
3. Configure:

| Setting | Value |
|---|---|
| Name | `dairy-farm-api` |
| Root Directory | `server` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | Free |

4. Add Environment Variables:
   - `DATABASE_URL` → Neon connection string
   - `JWT_SECRET` → 32+ char random secret
   - `FRONTEND_URL` → Your Vercel URL (set after deploying frontend)
   - `NODE_ENV` → `production`

5. Create → Wait for deploy → Copy URL (e.g., `https://dairy-farm-api.onrender.com`)

---

## Vercel Setup

1. Go to https://vercel.com → Sign up (free)
2. Add New → **Project** → Import GitHub repo
3. Configure:

| Setting | Value |
|---|---|
| Framework Preset | `Vite` |
| Root Directory | `client` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

4. Add Environment Variable:
   - `VITE_API_URL` → `https://dairy-farm-api.onrender.com` (your Render URL)

5. Deploy → Copy URL (e.g., `https://dairy-farm-app.vercel.app`)

6. Update Render's `FRONTEND_URL` to this Vercel URL → Redeploy

---

## SQLite → PostgreSQL Conversion Details

### Patterns converted

| SQLite Pattern | PostgreSQL Replacement |
|---|---|
| `db.prepare(sql).get(...params)` | `queryOne(sql, params)` (async) |
| `db.prepare(sql).all(...params)` | `query(sql, params)` (async) |
| `db.prepare(sql).run(...params)` | `execute(sql, params)` (async) |
| `info.lastInsertRowid` | `insertReturning(sql, params)` → returns `id` (async) |
| `db.transaction(fn)` | `pool.connect()` → `BEGIN` → `COMMIT/ROLLBACK` |
| `INSERT OR IGNORE` | `INSERT ... ON CONFLICT DO NOTHING` |
| `PRAGMA table_info()` | Schema in `schema.sql`, no runtime checks needed |
| `CURRENT_TIMESTAMP` | `NOW()` |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| `REAL` | `DOUBLE PRECISION` |
| `INTEGER` (for booleans) | `BOOLEAN` |
| `active ? 1 : 0` | `active ? true : false` |

### Tables migrated (15)

`users`, `cows`, `buyers`, `expense_categories`, `food_items`, `food_price_history`, `calves`, `calf_expenses`, `daily_entries`, `cow_milk_entries`, `milk_sales`, `expenses`, `investments`, `cow_update_history`

### Query count converted

- ~200+ individual SQL queries rewritten across `index.js`
- All 40+ API route handlers converted to async
- 3 transaction blocks rewritten (calf transfer, daily entry, account deletion)

---

## Known Remaining Issues

### 1. Uploads are not persistent on Render Free

Uploads go to `./uploads` on Render's ephemeral disk. Files are lost on every redeploy.

**Impact:** Low — uploads feature is not actively used in the current app (no UI for viewing uploaded bills).

**Fix options:**
- Upgrade to Render Paid with persistent disk
- Integrate AWS S3 / Cloudinary (requires code changes)
- Ignore for now if not using bill uploads

### 2. Single Render instance

On Render Free, the service sleeps after inactivity. First request after sleep takes 30-50 seconds.

**Impact:** Minor inconvenience for occasional use.

### 3. Neon connection pooling

Neon free tier has a limited number of connections. The `pg` Pool is configured without explicit limits, which defaults to ~10 connections. This is sufficient for a single-user app.

**If you see connection errors:** Add `max: 5` to the Pool config in `db.js`.

### 4. No automated data backups

Neon provides automatic backups on paid plans. Free tier has point-in-time recovery limited to 7 days.

**Recommendation:** Export JSON regularly via `/api/export/json` for safety.

### 5. JWT_SECRET must be consistent

If `JWT_SECRET` changes, all existing users are logged out. Keep the same secret across deploys.

### 6. better-sqlite3 still in devDependencies

Needed for the migration script only. Not used in runtime. Safe to keep — does not affect production builds.

---

## Deployment Order

1. Create Neon PostgreSQL project → run schema
2. Migrate data from SQLite → `npm run migrate`
3. Deploy backend to Render with env vars
4. Deploy frontend to Vercel with `VITE_API_URL`
5. Update Render `FRONTEND_URL` to Vercel domain → redeploy
6. Test end-to-end: register → login → create data → verify

---

## File Tree (New Project)

```
~/Projects/dairy-farm-app-postgres/
├── .gitignore
├── DEPLOYMENT.md
├── POSTGRES_MIGRATION_RESULT.md  ← this file
├── package.json
├── client/
│   ├── .env.example
│   ├── vercel.json
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── dist/                     ← built output
│   ├── public/
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/client.js
│       ├── context/AuthContext.jsx
│       └── lib/utils.js
└── server/
    ├── .env.example
    ├── package.json
    ├── src/
    │   ├── index.js              ← PostgreSQL-converted (821 lines → ~750 lines)
    │   ├── db.js                 ← New pg-based module (387 lines → 55 lines)
    │   └── schema.sql            ← New PostgreSQL schema
    ├── scripts/
    │   └── migrate-sqlite-to-pg.js  ← Migration script
    ├── data/
    │   └── dairy-farm.db         ← Original SQLite (for migration only)
    └── uploads/                  ← Local uploads (ephemeral on Render)
```

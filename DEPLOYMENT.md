# Deployment Guide - Vercel + Render + Neon PostgreSQL

## Architecture

```
Frontend (Vercel)  ──HTTPS──>  Backend (Render)  ──SSL──>  Database (Neon PostgreSQL)
```

---

## Prerequisites

1. **GitHub repository** with this project pushed
2. **Neon PostgreSQL** account (free): https://neon.tech
3. **Render** account (free): https://render.com
4. **Vercel** account (free): https://vercel.com

---

## Step 1: Create Neon PostgreSQL Database

1. Go to https://neon.tech and sign in
2. Click **"New Project"**
3. Name it: `dairy-farm-db`
4. Choose a region close to your users (or close to Render)
5. Click **"Create Project"**
6. On the dashboard, copy the **Connection string** (it looks like):
   ```
   postgresql://dairyfarm_owner:xxxx@ep-quiet-sun-123456.us-east-2.aws.neon.tech/dairyfarm?sslmode=require
   ```
7. Click **"Connect"** → **"Run SQL"** and execute the schema:
   - Copy the contents of `server/src/schema.sql`
   - Paste into Neon SQL editor and run it

---

## Step 2: Migrate SQLite Data to Neon

### Option A: Using the migration script (recommended)

```bash
# Install server dependencies (includes better-sqlite3 for migration)
cd server
npm install

# Run migration (replace with your Neon connection string)
DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/dairyfarm?sslmode=require" \
  npm run migrate
```

### Option B: Manual export/import

1. Start your local server with SQLite:
   ```bash
   cd server
   npm install
   node src/index.js  # with original db.js (if you kept a copy)
   ```
2. Open browser to `http://localhost:4000/api/export/json`
3. Save the JSON output
4. Write a script to insert that data into PostgreSQL

---

## Step 3: Deploy Backend to Render

### In Render Dashboard

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:

| Setting | Value |
|---|---|
| **Name** | `dairy-farm-api` |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free |

5. Add **Environment Variables**:

| Key | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string |
| `JWT_SECRET` | Run `openssl rand -hex 32` and paste result |
| `FRONTEND_URL` | `https://your-app.vercel.app` (your Vercel URL, set after Step 4) |
| `NODE_ENV` | `production` |

6. Click **"Create Web Service"**
7. Wait for deploy to complete
8. Copy your Render URL (e.g., `https://dairy-farm-api.onrender.com`)

---

## Step 4: Deploy Frontend to Vercel

### In Vercel Dashboard

1. Go to https://vercel.com
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Configure:

| Setting | Value |
|---|---|
| **Framework Preset** | `Vite` |
| **Root Directory** | `client` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

5. Add **Environment Variable**:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://dairy-farm-api.onrender.com` (your Render URL) |

6. Click **"Deploy"**
7. Copy your Vercel URL (e.g., `https://dairy-farm-app.vercel.app`)

---

## Step 5: Update CORS on Render

1. Go back to Render dashboard
2. Open your web service → **Environment**
3. Update `FRONTEND_URL` to your actual Vercel URL:
   ```
   FRONTEND_URL=https://dairy-farm-app.vercel.app
   ```
4. Redeploy (or trigger manual deploy)

---

## Step 6: Test

1. Open your Vercel URL in browser
2. Register a new account (first user)
3. Test login
4. Verify data loads correctly

---

## Local Development

### Setup

```bash
# Install all dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### Create .env files

**server/.env** (copy from .env.example):
```
DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/dairyfarm?sslmode=require
JWT_SECRET=test-secret-for-local-dev
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

**client/.env** (copy from .env.example):
```
VITE_API_URL=
```
(Leave empty for local dev — Vite proxy handles it)

### Run

```bash
# From root directory
npm run dev
```

This starts:
- Frontend: http://localhost:5173 (Vite with proxy to :4000)
- Backend: http://localhost:4000 (Express with nodemon)

---

## Uploads Warning

The `/uploads` directory stores uploaded bill images on the server's local filesystem.

**On Render Free Tier:**
- The disk is **ephemeral** — files are lost on every redeploy
- Uploads work during a single session but are not permanent

**Solutions for production:**
1. Use **Render Paid Tier** with persistent disk
2. Use **AWS S3** or **Cloudinary** for file storage (requires code changes)
3. Store `bill_path` as URLs pointing to external storage

For now, uploads work but are not durable on Render Free.

---

## Environment Variables Reference

### Backend (Render)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens (32+ random chars) |
| `FRONTEND_URL` | Yes | Your Vercel app URL for CORS |
| `PORT` | No | Render sets this automatically |
| `UPLOADS_DIR` | No | Defaults to `./uploads` |
| `NODE_ENV` | No | Set to `production` on Render |

### Frontend (Vercel)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Your Render backend URL |

---

## Troubleshooting

### "DATABASE_URL is required"
Make sure the environment variable is set in Render dashboard.

### CORS errors
Ensure `FRONTEND_URL` on Render matches your Vercel domain exactly (including https://).

### "relation does not exist"
Run the schema from `server/src/schema.sql` in Neon SQL editor.

### Data not appearing after migration
Run the migration script: `DATABASE_URL=... npm run migrate` in the server directory.

### JWT errors after redeploy
Make sure `JWT_SECRET` is the same across all deploys. If you change it, all users must re-login.

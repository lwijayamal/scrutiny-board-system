# Scrutiny Board Management System — 100% Free Deployment (No Card, Anywhere)

Stack: **Vercel** (hosts both the static frontend AND the backend as serverless functions) → **Supabase** (PostgreSQL database).

```
USER → Vercel (public/*.html,css,js  +  /api serverless functions) → SQL → Supabase (PostgreSQL)
```

Two services total. Neither Vercel's Hobby plan nor Supabase's Free plan requires a credit card to sign up or to stay on the free tier — both are genuinely free for a project like this (personal/student, non-commercial use).

---

## 0. Prerequisites

- VS Code opened on this folder
- Node.js v18+ installed (`node -v` in the VS Code terminal)
- Git installed (`git -v`)
- A free GitHub account (Vercel deploys straight from a GitHub repo)

---

## 1. Set up the Database (Supabase) — same as before

1. **supabase.com** → sign up free → **New Project** (`scrutiny-board-db`, set and save a DB password).
2. Wait for it to provision (~2 min).
3. **SQL Editor → New query** → paste the full contents of `database/schema.sql` → **Run**.
4. **Project Settings → Database → Connection string → URI** → copy the **Transaction pooler** string (port `6543`), replace `[YOUR-PASSWORD]` with your real password. Keep this private.

---

## 2. Test the Backend Locally

```bash
npm install
cp .env.example .env
```
Fill in `.env`:
- `DATABASE_URL` = your Supabase pooler string
- `JWT_SECRET` = any long random string

Run it:
```bash
npm run dev
```
This starts a plain local server at `http://localhost:5000/api` (using `dev.js` — a thin wrapper so you don't need the Vercel CLI just to test).

Create your admin user (second terminal, first one still running):
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"YourStrongPassword123\",\"role\":\"admin\",\"full_name\":\"System Admin\"}"
```

Test login:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"YourStrongPassword123\"}"
```
A JSON response with a `token` confirms the backend ↔ database connection works.

> ⚠️ Once your admin account exists, comment out or protect the `/register` route (`lib/routes/auth.js`) before your final deploy, so strangers can't create accounts on your live API.

To test the **frontend against this local backend**: open `public/js/config.js` and temporarily set
`const API_BASE_URL = 'http://localhost:5000/api';`, then open `public/index.html` directly in your browser (or with the VS Code "Live Server" extension). Change it back to `'/api'` before deploying to Vercel.

---

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Scrutiny Board Management System (Vercel + Supabase)"
```
Create a new empty repo on GitHub (no README, you already have one), then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/scrutiny-board-system.git
git branch -M main
git push -u origin main
```

---

## 4. Deploy to Vercel (frontend + backend together, one deployment)

1. Go to **vercel.com** → **Sign up** → choose **Continue with GitHub** (no card requested).
2. **Add New → Project** → select your `scrutiny-board-system` repo → **Import**.
3. Framework Preset: Vercel should auto-detect **"Other"** — that's correct, leave build settings default (no build command needed, `public/` is served automatically, `api/` becomes a serverless function).
4. Under **Environment Variables**, add:
   - `DATABASE_URL` = your Supabase pooler connection string
   - `JWT_SECRET` = same secret you used locally (or a new long random string)
5. Click **Deploy**. It takes under a minute.
6. Vercel gives you a live URL like `https://scrutiny-board-system.vercel.app`. Visit `https://scrutiny-board-system.vercel.app/api` — you should see `{"status":"ok", ...}`. Visit the root URL and you should see your login page.

That's it — **one deployment, one free service, no CORS setup needed** since frontend and API share the same domain. No sleep/cold-start issue like Render's free tier either; Vercel functions start fast per-request.

Every future `git push` to `main` auto-redeploys.

---

## 5. Test the Live System

1. Visit your `.vercel.app` URL.
2. Log in with the admin account from Step 2.
3. Confirm the dashboard loads students/boards from your live Supabase database through your live Vercel API.

---

## 6. What to Build Next (mapped to your assignment deliverables)

| Deliverable | Where to add it |
|---|---|
| More entities (Appeals, Attachments) | Add tables to `database/schema.sql`, add a new file in `lib/routes/`, mount it in `lib/app.js` |
| Role-based UI | Show/hide dashboard sections based on `user.role` in `dashboard.html` |
| Reports (PDF export) | Add a route using `pdfkit`, add it to `lib/routes/` |
| Security hardening | Protect/remove `/register` before final submission, add `express-rate-limit`, enforce a password policy |
| Presentation demo | Log in as different roles, show an invalid insert being rejected (e.g. marks > 100), show `audit_log` growing after a decision update |

---

## Troubleshooting

- **"Function not found" on `/api/students` etc.** → check `vercel.json` has the rewrite rule shown in this project; it routes every `/api/*` path to the single `api/index.js` function.
- **Works locally, fails on Vercel** → check **Vercel Dashboard → your project → Deployments → (latest) → Functions/Logs** for the real error; usually a missing/incorrect environment variable.
- **Database connection errors** → confirm you used the Supabase **pooler** URL (port 6543), not the direct one (port 5432) — serverless functions open many short-lived connections, and the free tier's direct-connection limit is easy to exceed.
- **CORS errors** → shouldn't happen since everything is same-origin on Vercel; if you see one, you're probably still pointing `public/js/config.js` at `localhost` — set it back to `/api`.

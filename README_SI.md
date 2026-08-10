# Scrutiny Board Management System — සම්පූර්ණ සිංහල මාර්ගෝපදේශය (A-Z)

**Stack:** Vercel (Frontend + Backend) + Supabase (Database) — සම්පූර්ණයෙන්ම නොමිලේ, කිසිම තැනක Card එකක් අවශ්‍ය නැත.

> ✅ ඔබ දැනටමත් Supabase database එක සාදා ඇති බැවින්, **පියවර 1 මඟහරින්න** (skip කරන්න) සහ **පියවර 2** සිට ආරම්භ කරන්න.

---

## පියවර 0: ඔබට තිබිය යුතු දේ (Prerequisites)

- VS Code – install කර තිබිය යුතුය
- Node.js (v18 හෝ ඉහළ) – install කර තිබිය යුතුය
  - පරීක්ෂා කිරීමට: VS Code terminal එකේ `node -v` ලියා Enter කරන්න. version number එකක් පෙන්විය යුතුය.
- Git – install කර තිබිය යුතුය (`git -v` command එකෙන් පරීක්ෂා කරන්න)
- GitHub account එකක් (නොමිලේ)
- ඔබේ project folder එක VS Code වලින් open කර ඇත

---

## පියවර 1: Supabase Database (දැනටමත් සම්පූර්ණයි ✅)

ඔබ මෙය දැනටමත් කර ඇත. නමුත් තහවුරු කර ගැනීමට:

1. **supabase.com** → ඔබේ project එකට යන්න
2. **SQL Editor** → ඔබ `database/schema.sql` file එකේ ඇති සම්පූර්ණ code එක copy කර run කර තිබේදැයි තහවුරු කරන්න
   - තහවුරු කිරීමට: වම් පස **Table Editor** එකට ගොස්, `students`, `scrutiny_boards`, `meetings`, `student_cases`, `decisions` වැනි tables පෙනේදැයි බලන්න.
3. **Project Settings (⚙️ icon) → Database → Connection string → URI**
   - **"Transaction pooler"** tab එක තෝරන්න (port `6543` සහිත එක, `5432` නොවේ)
   - මෙම string එක copy කරගන්න — එය මෙසේ පෙනේ:
     ```
     postgresql://postgres.xxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-xx-xxxx-x.pooler.supabase.com:6543/postgres
     ```
   - `[YOUR-PASSWORD]` කොටස ඔබ project සෑදූ විට set කළ **සත්‍ය database password** එකෙන් replace කරන්න.
   - ඔබට password එක මතක නැත්නම්: **Project Settings → Database → Reset Database Password** → letters සහ numbers පමණක් ඇති අලුත් password එකක් සකසන්න (special characters `@ # % / : ?` වළක්වා ගන්න — මේවා පසුව URL දෝෂ ඇති කරයි).

---

## පියවර 2: Project Folder එක සකසන්න

ඔබ පෙර දුන් `scrutiny-board-vercel.zip` file එක download කර, extract කර, VS Code වලින් open කරන්න.

VS Code Terminal එක open කරන්න: **Terminal → New Terminal** (හෝ `` Ctrl+` ``)

Terminal එකේ පහළ දකුණු කෙළවරේ **"powershell"** කියලා පෙන්නවාද බලන්න.

### Dependencies install කරන්න

```powershell
npm install
```

මෙය `node_modules` folder එකක් සාදනු ඇත (මෙය සාමාන්‍යයි, කරදර වෙන්න එපා).

---

## පියවර 3: `.env` File එක සකසන්න (**වැදගත්ම පියවර — පෙර දෝෂය මෙතනින්**)

`.env.example` file එක copy කර `.env` නමින් සාදන්න:

```powershell
Copy-Item .env.example .env
```

දැන් VS Code වම් පස File Explorer එකේ `.env` file එක click කර open කරන්න. එහි මෙසේ ලියා ඇත:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_PROJECT_REF.pooler.supabase.com:6543/postgres
JWT_SECRET=change_this_to_a_long_random_string
PORT=5000
```

### මෙය පියවර 1 හි ලබාගත් **සත්‍ය** connection string එකෙන් replace කරන්න:

**⚠️ මෙම වැරදි වළක්වා ගන්න (පෙර දෝෂයට හේතුව මේවා විය හැක):**

| වැරදි | නිවැරදි |
|---|---|
| `DATABASE_URL="postgresql://..."` (quotes සමඟ) | `DATABASE_URL=postgresql://...` (quotes **නැතිව**) |
| `YOUR_PASSWORD` / `YOUR_PROJECT_REF` වෙනස් නොකර තැබීම | ඔබේ **සත්‍ය** password සහ project reference දැමීම |
| URL එක පේළි 2කට කැඩී තිබීම | URL එක **එක පේළියක්ම** විය යුතුය |
| `DATABASE_URL =` (equal sign වට space ඇතුව) | `DATABASE_URL=` (space **නැතිව**) |

**උදාහරණයක් (සම්පූර්ණයෙන්ම නිවැරදි ආකෘතිය):**
```
DATABASE_URL=postgresql://postgres.abcdefghijklm:MySecurePass123@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
JWT_SECRET=my_super_secret_random_string_12345
PORT=5000
```

`JWT_SECRET` සඳහා ඕනෑම දිගු අහඹු (random) අකුරු/අංක මාලාවක් දැමිය හැක — precise value එක වැදගත් නැත, දිගින් හා රහසිගත බව පමණයි වැදගත්.

**Save කරන්න** (`Ctrl+S`).

---

## පියවර 4: Local Server එක Run කරන්න

```powershell
npm run dev
```

මෙසේ පෙනිය යුතුය:
```
Local dev API running at http://localhost:5000/api
```

**දෝෂයක් (error) පෙනේ නම්:**
- `Invalid URL` → පියවර 3 නැවත පරීක්ෂා කරන්න (quotes, spaces, placeholder text)
- `password authentication failed` → password එක වැරදියි; Supabase වෙතින් password reset කර නැවත copy කරන්න
- `getaddrinfo ENOTFOUND` → `YOUR_PROJECT_REF` කොටස තවම replace කර නැත, හෝ typo එකක් ඇත

Server එක සාර්ථකව run වුවහොත්, **එම terminal එක වසන්න එපා** — එය ක්‍රියාත්මකව තබන්න.

---

## පියවර 5: Admin Login එකක් සාදන්න

**අලුත් Terminal එකක් open කරන්න** (පළමු terminal එක තවමත් run වෙමින් තිබිය යුතුය): VS Code terminal panel එකේ `+` icon එක click කරන්න.

මෙම PowerShell command එක copy කර, අලුත් terminal එකට paste කර Enter කරන්න:

```powershell
$body = @{
    username  = "admin"
    password  = "YourStrongPassword123"
    role      = "admin"
    full_name = "System Admin"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/auth/register" -Method POST -ContentType "application/json" -Body $body
```

**සාර්ථක නම්**, මෙසේ ප්‍රතිඵලයක් පෙනේ:
```
user_id username role  full_name
------- -------- ----  ---------
      1 admin    admin System Admin
```

### Login එක test කරන්න:

```powershell
$loginBody = @{
    username = "admin"
    password = "YourStrongPassword123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
```

`token` එකක් සහිත ප්‍රතිඵලයක් ලැබුනොත් — **ඔබේ backend ↔ database සම්බන්ධතාවය සාර්ථකයි!** ✅

---

## පියවර 6: Frontend එක Local වශයෙන් Test කරන්න (Optional)

`public/js/config.js` file එක open කර, temporarily මෙසේ වෙනස් කරන්න:
```javascript
const API_BASE_URL = 'http://localhost:5000/api';
```

VS Code Extensions වලින් **"Live Server"** install කර, `public/index.html` මත right-click කර **"Open with Live Server"** click කරන්න. Admin username/password එකෙන් login වී dashboard එක load වේදැයි බලන්න.

**Vercel වෙත deploy කිරීමට පෙර**, `config.js` file එක නැවත මෙසේ වෙනස් කරන්න:
```javascript
const API_BASE_URL = '/api';
```

---

## පියවර 7: GitHub වෙත Push කරන්න

```powershell
git init
git add .
git commit -m "Initial commit: Scrutiny Board Management System"
```

GitHub.com → **New repository** (නම: `scrutiny-board-system`, README/Description නොදමන්න) → Create.

```powershell
git remote add origin https://github.com/YOUR_USERNAME/scrutiny-board-system.git
git branch -M main
git push -u origin main
```

> ⚠️ `.env` file එක push වන්නේ නැත — `.gitignore` හි එය already excluded කර ඇත. මෙය හොඳයි (password එක GitHub වෙත upload විය යුතු නැත).

---

## පියවර 8: Vercel වෙත Deploy කරන්න

1. **vercel.com** → **Sign Up** → **"Continue with GitHub"** (Card අවශ්‍ය නැත)
2. **Add New → Project** → ඔබේ `scrutiny-board-system` repository එක select කර **Import**
3. Framework Preset: **"Other"** ලෙස auto-detect විය යුතුය — settings වෙනස් කරන්න එපා
4. **Environment Variables** කොටසේ, මේවා දෙක add කරන්න:
   - Name: `DATABASE_URL`  → Value: ඔබේ Supabase pooler connection string එක
   - Name: `JWT_SECRET`  → Value: ඔබ `.env` හි භාවිතා කළ එකම string එක (හෝ අලුත් random string එකක්)
5. **Deploy** click කරන්න. තත්පර 30-60ක් තුළ deploy වේ.
6. Deploy වූ පසු, ලැබෙන URL එක (උදා: `https://scrutiny-board-system.vercel.app`) click කරන්න.
   - `/api` path එකට ගොස් (`https://scrutiny-board-system.vercel.app/api`) `{"status":"ok"}` පෙනේදැයි බලන්න.
   - root URL එකට ගොස් login page එක පෙනේදැයි බලන්න.

---

## පියවර 9: සම්පූර්ණ System එක Test කරන්න

1. ඔබේ live `.vercel.app` URL එකට යන්න
2. Admin username/password එකෙන් login වන්න
3. Dashboard එකේ students සහ boards Supabase database එකෙන් load වේදැයි තහවුරු කරන්න

**සාර්ථකයි! ඔබේ system එක දැන් සම්පූර්ණයෙන්ම live, සහ සම්පූර්ණයෙන්ම නොමිලේ.** 🎉

---

## ඉදිරියට කළ යුතු දේ (Assignment Deliverables සමඟ සම්බන්ධව)

| Deliverable | කරන්නේ කොහෙද |
|---|---|
| අමතර Entities (Appeals, Attachments) | `database/schema.sql` වෙත tables add කර, `lib/routes/` වෙත file අලුතින් add කර, `lib/app.js` හි mount කරන්න |
| Role-based UI | `dashboard.html` හි `user.role` අනුව sections පෙන්වීම/සැඟවීම |
| Reports (PDF) | `pdfkit` වැනි library එකක් සමඟ route එකක් add කරන්න |
| Security Hardening | Submit කිරීමට පෙර `/register` route එක disable/protect කරන්න |
| Presentation | විවිධ roles වලින් login වී පෙන්වන්න, වැරදි data (marks > 100) reject වන ආකාරය පෙන්වන්න |

---

## දෝෂ නිරාකරණය (Troubleshooting) — ඉක්මන් Checklist

| ගැටලුව | විසඳුම |
|---|---|
| `Invalid URL` error | `.env` හි `DATABASE_URL` පරීක්ෂා කරන්න — quotes නැත්ද, placeholder replace කර ඇත්ද, එක පේළියක්ම ද |
| `password authentication failed` | Supabase → Reset Database Password → `.env` update කරන්න |
| `curl` PowerShell error | `curl` වෙනුවට `Invoke-RestMethod` (පියවර 5 බලන්න) භාවිතා කරන්න |
| Vercel deploy වූ පසු `/api` වැඩ නොකරයි | Vercel → Project → Environment Variables දෙකම (`DATABASE_URL`, `JWT_SECRET`) නිවැරදිව set කර ඇත්දැයි බලන්න, redeploy කරන්න |
| CORS error | `public/js/config.js` හි `API_BASE_URL` එක `/api` ලෙස (localhost නොව) set කර ඇත්දැයි බලන්න |

---

**ගැටලුවක් තිබේ නම්**, එම error message එක සම්පූර්ණයෙන් copy කර මට එවන්න (password/token වැනි sensitive දේ `*****` කර මකන්න) — මම exact ගැටලුව සොයාගෙන උදව් කරන්නම්.

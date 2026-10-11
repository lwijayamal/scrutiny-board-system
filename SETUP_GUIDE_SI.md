# Scrutiny Board System — අලුත් Version එක ස්ථාපනය කිරීම (කේත දැනුම අවශ්‍ය නැත)

මෙම package එකේ **සම්පූර්ණ අලුත් system එක** ඇත (Project Proposal එකට ගැලපෙන Exam Paper Scrutiny system). ඔබට කේත ලියන්න අවශ්‍ය නැත — පියවර අනුව file වෙනස් කර, command කිහිපයක් run කරන්න පමණයි.

**Stack (නොමිලේ):** GitHub + Vercel + Supabase (PostgreSQL)

---

## 🔴 පළමුව — ආරක්ෂාව

ඔබේ `README_SI.md` file එකේ **Supabase database password එක** ලියා ඇත. පහත දේ කරන්න:

1. Supabase → **Project Settings → Database → Reset Database Password** → අලුත් password (අකුරු + ඉලක්කම් පමණක්)
2. VS Code හි `.env` file එකේ `DATABASE_URL` හි password කොටස update කරන්න
3. Vercel → Project → **Settings → Environment Variables** → `DATABASE_URL` update කර **Redeploy**
4. `README_SI.md` file එකෙන් password එක මකන්න

---

## පියවර 1 — Backup

ඔබේ `nextDB` folder එක **copy → paste** කර `nextDB-backup` ලෙස නම් කරන්න. (වැරදුනොත් ආපසු යාමට)

---

## පියවර 2 — පරණ files ඉවත් කර අලුත් ඒවා දමන්න

1. මෙම zip file එක **Extract** කරන්න (right-click → Extract All).
2. VS Code හි `nextDB` project එකේ, වම් පස File Explorer එකෙන් මේවා **Delete** කරන්න (right-click → Delete):
   - `api` folder
   - `lib` folder
   - `public` folder
   - `package-lock.json` file
3. Extract කළ folder එක ඇතුළේ ඇති **සියලුම files/folders** (`api`, `database`, `lib`, `public`, `dev.js`, `make-admin.js`, `package.json`, `vercel.json`, `.env.example`, `SETUP_GUIDE_SI.md`) **copy** කර `nextDB` folder එකට paste කරන්න. "Replace files" ඇසුවොත් **Replace** තෝරන්න.

> ⚠️ ඔබේ `.env` file එකට, `.git` folder එකට සහ `node_modules` folder එකට **අත නොතබන්න**.

`.env` file එකේ මෙම පේළි 3 තිබිය යුතුයි (ඔබ කලින් සකසා ඇත):
```
DATABASE_URL=postgresql://postgres.xxxx:ඔබේ-password@aws-0-xx.pooler.supabase.com:6543/postgres
JWT_SECRET=දිගු-අහඹු-අකුරු
PORT=5000
```

---

## පියවර 3 — Database එක අලුත් කරන්න (Supabase)

1. VS Code හි `database/schema.sql` file එක open කරන්න → `Ctrl+A` → `Ctrl+C`
2. **supabase.com** → ඔබේ project → වම් පස **SQL Editor** → **New query**
3. `Ctrl+V` (paste) → **Run** click කරන්න
4. **"Success"** පණිවිඩයක් පෙනිය යුතුයි.
5. වම් පස **Table Editor** හි මෙම tables පෙනිය යුතුයි: `exam_papers`, `moderation_cycles`, `documents`, `scrutiny_boards`, `hod_verifications`, `scrutiny_reviews` ...

> ⚠️ මෙය **පරණ tables (students, meetings ආදිය) මකා දමයි**. ඔබේ `users` table (admin login) **ආරක්ෂා වේ**.
> Error එකක් ආවොත් — error message එක සම්පූර්ණයෙන් copy කර මට එවන්න.

---

## පියවර 4 — Local එකේ Run කරන්න

VS Code → **Terminal → New Terminal**:

```powershell
npm install
npm run dev
```

මෙසේ පෙනිය යුතුයි:
```
Local dev API running at http://localhost:5000/api
Open the website:       http://localhost:5000
```

Browser එකේ **http://localhost:5000** open කරන්න. (Live Server තවදුරටත් අවශ්‍ය නැත; `config.js` වෙනස් කිරීමද අවශ්‍ය නැත.)

**Login:** ඔබ කලින් සෑදූ admin username/password භාවිතා කරන්න.

Password අමතක නම් / login වැඩ නොකරන්නේ නම් — **දෙවන terminal එකක්** open කර (`+` icon):
```powershell
node make-admin.js admin NewPassword123
```
ඉන්පසු `admin` / `NewPassword123` වලින් login වන්න.

---

## පියවර 5 — Data ඇතුළත් කරන ආකාරය (අනුපිළිවෙල වැදගත්)

Admin ලෙස login වී, වම් menu එකෙන් මෙම අනුපිළිවෙලට:

1. **Users** → පරීක්ෂණ සඳහා users සාදන්න: `lec1` (role: lecturer), `mod1` (moderator), `hod1` (hod)
2. **Examinations** → උදා: 2025/2026, Semester 1, End Semester Exam, End Semester
3. **Courses** → උදා: ICT1212 – Database Management Systems
4. **Exam Timetable** → examination + course + දිනය + වේලාව
5. **Lecturers** → නම ඇතුළත් කර, **Login account** ලෙස `lec1` තෝරන්න
6. **Moderators** → නම ඇතුළත් කර `mod1` තෝරන්න
7. **Heads of Dept.** → නම ඇතුළත් කර `hod1` තෝරන්න
8. **Scrutiny Boards** → board date + submission deadline (deadline ≤ board date)
9. **Exam Papers** → timetable entry, title, lecturer, moderator තෝරා **Add paper**

---

## පියවර 6 — සම්පූර්ණ Process එක Test කරන්න

**Exam Papers → Open** (paper එක) කර, **"Next step"** කොටසේ ඇති ක්‍රියාව අනුව යන්න. (Admin ලෙස ඕනෑම පියවරක් කළ හැක; role පරීක්ෂා කිරීමට අදාළ user ලෙස login වන්න.)

| # | කරන්නේ | කවුද | Status වෙනස |
|---|---|---|---|
| 1 | Examination Paper සහ Marking Scheme → **Mark Available** | Lecturer | Pending Moderation |
| 2 | **Send for moderation** | Lecturer | → Under Moderation |
| 3 | Moderation result: **Corrections Required** + corrections ලියන්න | Moderator | → Revision Required |
| 4 | **Resubmit for moderation** (revision details) | Lecturer | → Under Moderation (cycle 2) |
| 5 | Moderation result: **Completed** (Moderator Report ස්වයංක්‍රීයව Available වේ) | Moderator | → Moderation Completed |
| 6 | **Verify** | HOD | → Ready for Scrutiny |
| 7 | **Assign board** | HOD | → Under Scrutiny |
| 8 | **Save review** → **Save decision** (Approved / Corrections Required / Rejected) | HOD | → Approved / Rejected / Revision Required |

**Rules ක්‍රියා කරනවාදැයි පෙන්වීමට (Presentation/Testing සඳහා):**
- Moderator නැති paper එකක් moderation වලට යැවීම → **Error**
- Documents නොමැතිව / Moderation Completed නොවී **Verify** කිරීම → **Error**
- Verify නොකළ paper එකක් Board එකකට assign කිරීම → **Error**
- Lecturer ලෙස login වී Verify කිරීමට උත්සාහ කිරීම → **403 (role not allowed)**
- Paper page හි **Status history** හි සියලු වෙනස්කම් පෙනේ

**Reports** menu: Paper status, Moderation progress, Missing documents, Boards summary, Decisions, Status history, Audit log (admin) — **Print / Save as PDF** සහ **CSV download** සමඟ.

---

## Role එකකට කළ හැකි දේ

| Role | අවසර |
|---|---|
| **admin** | සියල්ල + Users කළමනාකරණය + Audit log |
| **hod** | Boards, papers, verification, scrutiny review/decision, reports |
| **lecturer** | තමාගේ papers පමණක් — documents, send for moderation, resubmit |
| **moderator** | තමන්ට assign කළ papers පමණක් — moderation result, Moderator Report |
| **staff** | Examinations/Timetable/Courses/Papers ඇතුළත් කිරීම, reports |

---

## පියවර 7 — GitHub + Vercel වෙත Deploy කරන්න

```powershell
git add .
git commit -m "Update system to match project proposal"
git push
```

Vercel ස්වයංක්‍රීයව redeploy කරයි (තත්පර 30–60). Environment variables (`DATABASE_URL`, `JWT_SECRET`) කලින් සකසා ඇති නිසා අලුතින් කිසිවක් අවශ්‍ය නැත.

පරීක්ෂා කරන්න:
- `https://ඔබේ-site.vercel.app/api` → `{"status":"ok"}`
- `https://ඔබේ-site.vercel.app` → login page

---

## දෝෂ නිරාකරණය

| ගැටලුව | විසඳුම |
|---|---|
| `npm install` error | VS Code terminal එක `nextDB` folder එකේ ද බලන්න; Node.js v18+ ද බලන්න |
| `Invalid URL` / `password authentication failed` | `.env` හි `DATABASE_URL` (quotes නැතිව, එක පේළියක්, නිවැරදි password) |
| Login: "Wrong username or password" | `node make-admin.js admin NewPassword123` |
| Page එකේ "Session expired" | Logout වී නැවත login වන්න |
| Page හිස්ව / "relation does not exist" | පියවර 3 (SQL) සාර්ථකව run වී නැත — නැවත run කරන්න |
| Vercel හි `/api` වැඩ නොකරයි | Vercel → Settings → Environment Variables දෙක සහ Redeploy |
| ඕනෑම වෙනත් error | Error text එක (password/token මකා) මට එවන්න |

---

## Submit කිරීමට පෙර

- [x] `/api/auth/register` දැන් **admin-only** (කලින් ඕනෑම කෙනෙකුට විවෘත විය)
- [ ] Database password reset කර ඇත
- [ ] `JWT_SECRET` ශක්තිමත් random string එකක්
- [ ] Demo data: papers කිහිපයක් විවිධ statuses වල තබන්න

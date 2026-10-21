# EduCycle

<<<<<<< HEAD
EduCycle is a campus platform where students **donate, lend and exchange** textbooks, notes, calculators, electronics and lab equipment. Exchanges take place only at **pickup points approved by an administrator**, and students can report problems through a tracked **grievance** system.

Version 2 replaces the original static prototype, which used JSON files, `sessionStorage` and a hard-coded user. It now has a Node.js/Express backend, MongoDB persistence, real authentication, a separate admin dashboard and a redesigned interface.

---

## Contents

1. [Features](#features)
2. [Technology](#technology)
3. [Project structure](#project-structure)
4. [Quick start (VS Code terminal)](#quick-start-vs-code-terminal)
5. [Setting up MongoDB](#setting-up-mongodb)
6. [Environment variables](#environment-variables)
7. [Creating the first administrator](#creating-the-first-administrator)
8. [Importing the prototype data](#importing-the-prototype-data)
9. [Running the app](#running-the-app)
10. [API reference](#api-reference)
11. [Security notes and known limitations](#security-notes-and-known-limitations)
12. [What changed from the prototype](#what-changed-from-the-prototype)

---

## Features

**Students**
- Register, log in and log out. Sessions are kept in MongoDB, and passwords are stored only as bcrypt hashes.
- Browse with search, category, type, condition, department, semester and pickup-point filters, plus sorting and pagination.
- List a resource with grouped fields, validation, an **approved pickup point dropdown** and a department dropdown that includes **Electronics & Computer Engineering**.
- Manage listings: edit, mark available or unavailable, and delete with a confirmation dialog.
- Exchange workflow with a progress stepper:
  `Pending → Accepted → Handed over → Completed`, plus `Declined` and `Cancelled`.
  - Donate and Exchange: the requester confirms receipt.
  - Lend: the owner confirms the item was returned, and the listing becomes available again.
- **Pickup points**: view the approved locations, suggest a new one, and follow your suggestions (Pending, Approved, or Rejected with the reason).
- **Grievances**: submit a grievance with a category, subject, description and optional related exchange or listing. You get a reference such as `GRV-2026-7KQ4M2` and can see the status, the admin's response and the history. Safety concerns are marked high priority automatically.
- "Report it" on any listing creates a grievance and adds to the listing's report count.
- Community requests board: post what you need, and other students can offer one of their listings.
- Notification centre with read and unread states, and a badge in the navbar.
- Account settings: edit your profile, change your password, and see your activity history.
- Information pages: Help/FAQ, Safety guidelines, Privacy policy, Terms of use, and a 404 page.

**Administrators** (separate login at `/admin-login.html`)
- Overview with live counts of users, active resources, pending requests, completed exchanges, pending locations, open grievances and reported listings. It also has an 8-week activity chart, breakdowns by status and category, a "needs review" queue and a recent activity feed. All figures are computed from MongoDB.
- **Resources**: search and filter (including reported only), review a listing with its requests and grievances, and disable or restore it with a reason.
- **Requests and exchanges**: filter by status, type, title and date range.
- **Location management**: filter by status, approve, reject with a reason, edit, disable or re-enable, add a location directly, and see the approval history and usage.
- **Grievances**: search by reference or subject, filter by status, category and priority, update the status, write a response and assign to an administrator. The student is notified of each change.
- **Users**: search, view counts and recent activity, and disable or re-activate student accounts. A disabled student is signed out immediately and their listings are hidden.
- **Activity log**: every important action, filterable by type.

## Technology

| Layer | Choice |
|---|---|
| Frontend | HTML5, CSS3, Bootstrap 5.3, Bootstrap Icons, vanilla JavaScript, Inter font (all self-hosted in `frontend/assets/vendor`, so the site works offline) |
| Backend | Node.js 20+ and Express 5 |
| Database | MongoDB (NoSQL) with Mongoose only (no SQL anywhere) |
| Auth | Server-side sessions (`express-session` + `connect-mongo`), bcryptjs (12 rounds) |
| Security | Helmet (CSP and security headers), CSRF tokens, `express-rate-limit`, server-side validation |
=======
**Educational Resource Reuse and Exchange Platform**

EduCycle is a campus platform that lets students donate, lend, borrow and exchange academic resources — textbooks, notes, electronics, calculators and lab equipment — instead of letting usable items sit unused. This repository contains the front-end prototype built for Evaluation 1.

## Live features

- **Browse** resources with search, type tabs (Donate / Lend / Exchange), category filters and sort
- **Resource Details** with a status tracker (Pending → Accepted → Handed Over → Completed)
- **Request Board** for posting and offering against things students still need
- **Your Activity** dashboard with estimated impact (money saved, CO₂ avoided) on completed exchanges
- **My Listings** to manage resources you've posted
- **List a Resource** form with inline validation
- Simple **Log in / Create account** flow

## Tech stack

- HTML5, CSS3 (custom styling)
- Vanilla JavaScript (no framework)
- A JSON file as a mock data layer — there is no real backend or database yet

There is no build step. The app loads its data once from `data/data.json` and then keeps it in the browser's `sessionStorage` for the rest of the session, updating that cached copy as you interact with the app.
>>>>>>> 3563a5a6b42d3851af8952636aa532cbdc32cc50

## Project structure

```
EduCycle/
<<<<<<< HEAD
├── frontend/                  Static site, served by the backend
│   ├── index.html … 404.html  One file per page (student pages + admin-login.html + admin.html)
│   └── assets/
│       ├── css/style.css      Design system (espresso #2E251C, honey gold #946520, cream #F4F3ED, sand #EBE6DA)
│       ├── js/core.js         API client, session, nav/footer, badges, cards, toasts, dialogs
│       ├── js/suggest-location.js
│       ├── js/pages/*.js      One script per page (admin.js = dashboard)
│       ├── img/favicon.svg
│       └── vendor/            Bootstrap, Bootstrap Icons, Inter (licences included)
├── backend/
│   ├── src/
│   │   ├── server.js          Entry point: connects to MongoDB and starts Express
│   │   ├── app.js             Express app: security middleware, sessions, API, static files
│   │   ├── config/            env.js, db.js, constants.js (categories, statuses, grievance categories)
│   │   ├── models/            User, Resource, ExchangeRequest, Location, Grievance, Notification, ActivityLog, BoardPost
│   │   ├── controllers/       Request handlers per area
│   │   ├── routes/            /api route groups
│   │   ├── middleware/        auth, csrf, rate limits, operator-injection guard, errors
│   │   └── utils/             validation, pagination, activity/notification helpers, response shaping
│   ├── scripts/
│   │   ├── create-admin.js    Creates the first administrator from env variables or a prompt
│   │   └── migrate-legacy.js  Imports the prototype's data.json (repeatable, no duplicates)
│   └── data/legacy-data.json  The prototype's original data, kept only for the migration
├── .env.example
├── package.json               Shortcut scripts (setup, start, dev, migrate, create-admin)
└── README.md
```

The frontend and the API are served by **the same Express server**, so the session cookie is first-party and no CORS setup is needed. The old `data/data.js`, `data/data.json` and `sessionStorage` logic have been removed from the frontend. MongoDB is now the only source of truth.

## Quick start (VS Code terminal)

You need **Node.js 20 or newer** (`node -v`) and a local **MongoDB** database (see below).

```bash
# 1. Install dependencies
npm run setup                 # same as: cd backend && npm install

# 2. Create your configuration
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
#    then edit .env: set MONGODB_URI and SESSION_SECRET (see below)

# 3. Create the first administrator (prompts if ADMIN_* are not set in .env)
npm run create-admin

# 4. (Optional) import the prototype's sample data
npm run migrate

# 5. Start the server
npm start                     # or: npm run dev  (restarts on file changes)
```

Then open:

- Student site: **http://localhost:3000**
- Admin login: **http://localhost:3000/admin-login.html**

> Open the site through the server URL above. Opening the HTML files directly from disk (`file://`) will not work, because the pages need the API.

## Setting up MongoDB

Install MongoDB Community Server from https://www.mongodb.com/try/download/community (and optionally MongoDB Compass), make sure the service is running, and use this in `.env`:

`MONGODB_URI=mongodb://127.0.0.1:27017/educycle`

The collections and indexes are created automatically when the server starts.

## Environment variables

All configuration lives in `.env` in the project root. Copy it from `.env.example`. **Never commit `.env`**; it is listed in `.gitignore`.

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string |
| `SESSION_SECRET` | yes in production | Long random string that signs session cookies. Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `PORT` | no (3000) | HTTP port |
| `SESSION_MAX_AGE_HOURS` | no (72) | How long an inactive login lasts |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | no | Read by `npm run create-admin` |
| `DEMO_USER_PASSWORD` | no | Lets the imported demo students sign in |

## Creating the first administrator

Administrator accounts **cannot** be created from the website, and no admin credentials exist in the code or in this ZIP.

```bash
npm run create-admin
```

The script reads `ADMIN_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`. If they are missing, it asks for them, and the password is not echoed. Admin passwords must be at least 12 characters with letters and numbers. **After the account is created, remove `ADMIN_PASSWORD` from `.env`.**

Other options:

```bash
cd backend
node scripts/create-admin.js --reset-password   # set a new password for an existing admin
node scripts/create-admin.js --promote          # turn an existing student account into an admin
```

## Importing the prototype data

```bash
npm run migrate
```

This imports `backend/data/legacy-data.json` (the original `data.json`). It is **safe to run more than once**: records are matched by legacy ID, email or location name, so nothing is duplicated and later edits are not overwritten.

| Prototype data | What happens |
|---|---|
| 6 students (Riya Sharma and others) | Created as **demo** student accounts (`isDemo`). Riya keeps her original email `riya.sharma@college.edu`. The others get `firstname.lastname@college.edu`. If `DEMO_USER_PASSWORD` is set they can sign in with it; otherwise they get random passwords and only own the sample data. |
| 8 resources | Imported with their category, type, condition, department, semester, quantity, status and date |
| 7 requests | Imported. The prototype's `Rejected` status becomes `Declined`, and a status history is reconstructed. |
| 5 community requests | Imported |
| 5 pickup locations (Main Library Gate, Canteen Block, EXTC Lab Corridor, Hostel Block A, Workshop Entrance) | Imported as **Pending**, with no campus area, because nobody has verified them. An admin must review them, add the area, and approve them. Until then their listings show "Pickup point awaiting approval" and cannot be requested. |
| `impactFactors` (estimated ₹ / CO₂ per category) | **Not imported.** The figures were estimates that were not backed by data, so the homepage only shows real counts. |
| `currentUser` (hard-coded login) | Removed. Everyone now signs in with their own account. |

**Suggested demo:** run the migration, sign in as admin, open *Locations*, edit **Main Library Gate** (add an area) and approve it. Then sign in as a student. The Casio calculator listing at that point can now be requested.

## Running the app

```bash
npm start          # production-style start
npm run dev        # auto-restart on changes (Node's --watch)
```

The server logs its URL. It stops with a clear message if MongoDB cannot be reached. A health check is available at `GET /api/health`.

## API reference

All endpoints are under `/api` and return JSON. Errors look like this:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": { "title": "…" } } }
```

State-changing requests must send the `X-CSRF-Token` header. The token comes from `GET /api/auth/csrf` or `/api/auth/me`, and `assets/js/core.js` handles this automatically. List endpoints accept `page` and `limit` and return `{ items, pagination: { page, limit, total, pages } }`.

| Method & path | Access | Purpose |
|---|---|---|
| `GET /api/health`, `/api/meta`, `/api/stats` | public | Health check, dropdown vocabularies, homepage counts |
| `GET /api/auth/csrf`, `GET /api/auth/me` | public | CSRF token, current user |
| `POST /api/auth/register` · `/login` · `/admin/login` · `/logout` | public | Authentication (rate-limited) |
| `PATCH /api/auth/me`, `POST /api/auth/password` | signed in | Profile, change password |
| `GET /api/resources` · `/featured` · `/:id` | public | Browse (`q, category, type, condition, department, semester, location, availability=all, sort, page`) |
| `GET /api/resources/mine` | student | Own listings with request counts |
| `POST /api/resources`, `PATCH /api/resources/:id` (JSON) · `DELETE /:id` | student, owner only | Create, edit, delete |
| `POST /api/requests` · `GET /mine` · `GET /:id` | student | Request a resource, see your exchanges |
| `PATCH /api/requests/:id/accept·decline·cancel·location·handover·complete` | participant (role-checked) | Exchange workflow |
| `GET /api/locations` | public | Approved, active pickup points |
| `GET /api/locations/mine`, `POST /api/locations` | student | Own suggestions; suggest a new location |
| `POST /api/grievances` · `GET /mine` · `GET /:id` | student (own only) | Grievances |
| `GET/POST /api/board`, `PATCH /:id/close`, `POST /:id/offers` | public read; student write | Community requests |
| `GET /api/notifications` · `/count`, `PATCH /:id/read`, `PATCH /read-all` | signed in | Notifications |
| `GET /api/activity/mine` | signed in | Your activity history |
| `GET /api/admin/stats` · `/activity` · `/admins` | admin | Dashboard |
| `GET /api/admin/users` · `/:id`, `PATCH /:id/status` | admin | User management |
| `GET /api/admin/resources` · `/:id`, `PATCH /:id/moderation` | admin | Listing moderation |
| `GET /api/admin/requests` | admin | Requests and exchanges (`status, type, q, from, to`) |
| `GET/POST /api/admin/locations`, `GET/PATCH /:id`, `PATCH /:id/approve·reject` | admin | Location management |
| `GET /api/admin/grievances` · `/:id`, `PATCH /:id` | admin | Grievance management |

Dropdown values (categories, conditions, departments, grievance categories and so on) are defined once in `backend/src/config/constants.js`. If you change them there, every form updates without any frontend change.

## Security notes and known limitations

**What is implemented**

- Passwords are hashed with bcrypt (12 rounds) and are never returned or logged. Login uses a constant-time comparison against a dummy hash, so it does not reveal which emails are registered.
- Sessions are server-side and stored in MongoDB. The cookie is `HttpOnly` and `SameSite=Lax`. The session ID is regenerated on login and on password change.
- Every role and ownership check happens on the server. Unknown body fields are dropped, so `role`, `owner` and `status` cannot be injected. Students get `403` from every admin API, and `admin.html` redirects anyone who is not an admin.
- CSRF uses a synchronizer token on every `POST`, `PATCH` or `DELETE`.
- Login is rate-limited (8 failed attempts per IP and email, and 40 per IP, in 15 minutes). Registration and general write requests are also rate-limited.
- Input is validated on the server for type, length, enums and ObjectIds. Request keys starting with `$` or containing `.` are rejected to prevent MongoDB operator injection.
- Helmet sets a strict Content Security Policy (same-origin scripts only, with no inline scripts) and other security headers. All output in the frontend is HTML-escaped.
- Activity logs never contain passwords, tokens or session data.

**Limitations and items that need your input**

- **No email verification or password-reset email.** Any email address can register, and you may want to restrict sign-up to your college domain. Forgotten passwords have to be reset by an admin (`create-admin --reset-password` works for admins only; there is no reset for students yet). Both need an email provider.
- **The rate limiter stores its counts in memory**, so the counts reset on restart and are not shared between several server instances. Use a shared store (for example Redis) if you scale out.
- Students cannot message each other directly. Coordination happens through request messages, owner notes and the agreed pickup point.
- Notifications appear in the app only (the badge updates every 60 seconds). There are no email or push notifications.
- Imported pickup locations need admin review before they can be used, by design.

These measures improve security, but this project has not had a professional security audit and should not be treated as production-hardened.

## What changed from the prototype

| Area | Before | Now |
|---|---|---|
| Data | `data.json` + `data.js` (duplicate copies) + `sessionStorage` | MongoDB through a REST API, one source of truth |
| Login | Any input logged you in as the hard-coded "Riya Sharma" | Real accounts, bcrypt hashes, server sessions, separate admin login |
| Pickup location | Free-text field | Dropdown of admin-approved locations, plus the suggestion and approval workflow |
| Report listing | Modal with no backend | Creates a tracked grievance and increments the listing's report count |
| Grievances / admin | None | Full grievance system and admin dashboard |
| Statuses | `Rejected` | `Declined`, plus `Cancelled`, with history and notifications |
| Design | Serif headings, violet palette (did not match the brief) | Inter, charcoal / crimson / light-grey system, consistent Bootstrap components, responsive layout, accessible focus states, and badges that use icon and text rather than colour alone |
| Impact numbers | Estimated ₹ and CO₂ from guessed factors | Only real counts from the database |

> Note: the original JavaScript files (`js/main.js`, `browse.js` and the others) were not among the uploaded files, so the frontend scripts were rewritten against the new API. The behaviour of the original pages was preserved, as shown by their HTML.
=======
├── index.html              Home
├── browse.html              Browse
├── resource-details.html    Resource details + status tracker
├── login.html                Log in / Create account
├── request-board.html        Request Board
├── activity.html              Your Activity
├── my-listings.html           My Listings
├── list-resource.html         List a Resource form
├── css/
│   └── style.css              All styling
├── data/
│   ├── data.json              Dummy data: users, resources, requests, board posts, impact factors
│   └── data.js                 Data access helpers
└── js/
    ├── main.js                 Shared: navbar, data loading, toasts, impact calculation
    ├── validators.js           Shared form validation
    ├── home.js
    ├── browse.js
    ├── details.js
    ├── auth.js
    ├── list-resource.js
    ├── board.js
    ├── activity.js
    └── my-listings.js
```

## Running it locally

No installation needed. Either:

- Open `index.html` directly in a browser, or
- Serve the folder locally for the most reliable experience, e.g.:
  ```bash
  npx serve .
  ```
  or, with Python:
  ```bash
  python3 -m http.server
  ```

## Roadmap

The current prototype uses estimated impact figures and a dummy JSON data layer. The next stage replaces this with:

- A React front end
- A Node.js / Express API
- A MySQL database for real persistence and accounts

## SDG alignment

- **SDG 4 – Quality Education**: keeps learning material within reach regardless of cost
- **SDG 10 – Reduced Inequalities**: makes exchange free or low-cost for every student
- **SDG 12 – Responsible Consumption and Production**: keeps usable items in circulation instead of discarded
>>>>>>> 3563a5a6b42d3851af8952636aa532cbdc32cc50

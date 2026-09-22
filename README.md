# EduCycle

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

## Project structure

```
EduCycle/
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

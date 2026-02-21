# Frontend

React + Vite single-page application for Splitzy Pay.

---

## Structure

```
frontend/
├── src/
│   ├── pages/
│   │   ├── Login.jsx           # /login
│   │   ├── Signup.jsx          # /signup
│   │   ├── Dashboard.jsx       # / — balance stats, activity feed, chart
│   │   ├── Groups.jsx          # /groups — list + create
│   │   ├── GroupDetails.jsx    # /groups/:id — members, expenses, balances
│   │   ├── Payments.jsx        # /payments — send money + history
│   │   ├── Analytics.jsx       # /analytics — category + monthly charts
│   │   └── FutureExpenses.jsx  # /future — plan upcoming costs
│   ├── components/
│   │   └── Layout.jsx          # Sidebar nav, user avatar, logout
│   ├── context/
│   │   └── AuthContext.jsx     # JWT auth state — login/logout/session restore
│   ├── lib/
│   │   └── api.js              # Axios instance + JWT interceptors
│   ├── App.jsx                 # Router + route definitions
│   ├── main.jsx                # React root
│   └── index.css               # Tailwind base + custom component classes
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── package.json
```

---

## Setup

```bash
npm install
npm run dev        # http://localhost:5173
```

Requires the backend running on port 5001. The API base URL is configured in `src/lib/api.js`.

---

## Pages

| Route | Page | Auth required |
|---|---|---|
| `/login` | Login | No |
| `/signup` | Signup | No |
| `/` | Dashboard | Yes |
| `/groups` | Groups list | Yes |
| `/groups/:id` | Group detail | Yes |
| `/payments` | Payments | Yes |
| `/analytics` | Analytics | Yes |
| `/future` | Future Expenses | Yes |

---

## Auth Flow

1. User signs up or logs in → backend returns a **JWT access token**
2. Token stored in `localStorage` under `splitzy_token`
3. `AuthContext` restores the session on page load by calling `GET /api/auth/profile`
4. Axios request interceptor automatically attaches `Authorization: Bearer <token>` to every request
5. On 401, the interceptor clears the token from storage

---

## Key Dependencies

| Package | Purpose |
|---|---|
| `react-router-dom` v7 | Client-side routing |
| `axios` | HTTP client |
| `chart.js` + `react-chartjs-2` | Doughnut and bar charts |
| `lucide-react` | Icons |
| `tailwindcss` v3 | Utility-first CSS |
| `clsx` | Conditional classname helper |

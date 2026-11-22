# EV-Net

**Peer-to-peer EV charging for Pakistan.** EV-Net connects EV drivers with
households and businesses that have idle chargers. Drivers find and book a
nearby charger; hosts earn from equipment that would otherwise sit unused; an
admin team verifies people, listings and payments.

## Features

| EV drivers | Hosts | Admins |
| --- | --- | --- |
| Map-based charger search with filters | Guided onboarding & CNIC verification | Dashboard with revenue and payout metrics |
| Charger details, reviews, favourites | Create and manage listings with photos & location | Verification queue for users, hosts and listings |
| Booking with day/night kWh pricing | Weekly availability rules | Booking and bank-transfer payment review |
| Bank-transfer checkout with proof upload | Accept / decline booking requests | User management, reports and disputes |
| Messaging that unlocks once a booking exists | Earnings overview | Conversation oversight, archiving |

## Tech stack

- **Frontend:** React 19, Vite, React Router 7, Zustand
- **Maps:** Leaflet + React-Leaflet (OpenStreetMap / CARTO tiles, Nominatim geocoding)
- **Backend:** Supabase (Postgres, Auth, Storage, RPC functions, row-level security)
- **Hosting:** Vercel (SPA rewrites, caching and security headers in `vercel.json`)

## Getting started

Requires **Node.js 20.19+** (Node 22 recommended).

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

The app runs at <http://localhost:5173>.

### Mock mode (no backend needed)

With `VITE_USE_MOCK=true` the app runs entirely on seeded data from
`src/data/seed.js`, which is ideal for UI work and demos. These demo accounts
are available:

| Role | Email | Password |
| --- | --- | --- |
| EV driver | `ali@example.com` | `demo123` |
| Host | `omar@example.com` | `demo123` |
| Admin | `admin@EV-Net.pk` | `admin123` |

In mock mode a **⚡ Demo Mode** switcher appears in the bottom-right corner
during development, or on any build when you add `?demo=1` to the URL. It
lets you jump between the three roles instantly.

### Supabase mode

Set `VITE_USE_MOCK=false` and fill in `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` from your Supabase project's API settings. Apply the
schema with the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
```

```bash
supabase db push
```

Migrations live in `supabase/migrations/` and are applied in filename order.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm run check` | Lint + build (the same checks CI runs) |

## Project structure

```
src/
├── App.jsx              # Routes (code-split per page), error boundary
├── components/          # Landing-page sections and shared UI (components/ui)
├── layouts/             # App shells for drivers, hosts and admins
├── pages/
│   ├── public/          # Landing page
│   ├── auth/            # Login, sign-up, OAuth callback
│   ├── app/             # EV driver screens
│   ├── host/            # Host screens
│   ├── admin/           # Moderation console
│   └── shared/          # 404 and shared screens
├── data/
│   ├── api.js           # Picks the mock or Supabase API at startup
│   ├── api.supabase.js  # Supabase implementation
│   ├── api.mock.js      # In-memory implementation over seed.js
│   └── feeConfig.js     # Pricing and platform fee rules
├── store/               # Zustand stores (auth, app state, page cache)
└── utils/               # Access control, navigation and text helpers
supabase/migrations/     # Database schema, RLS policies and RPCs
branding/                # Source logo files (not bundled)
```

## Deployment

The project deploys to Vercel as a static SPA. Set `VITE_USE_MOCK`,
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project's
environment variables. `vercel.json` rewrites all routes to `index.html`,
caches hashed assets for a year, and adds standard security headers.

# Lesson Tracking

A skating-coach invoicing app — manage skaters, log lessons, generate PDF invoices, and email them via Gmail. Built on [Base44](https://base44.com) (backend + hosting) and React + Vite (frontend).

## Structure

```
base44/                    # Backend, managed by the Base44 CLI
├── config.jsonc           # Project settings
├── auth/                  # Auth config (Google login, etc.)
├── entities/              # Data schemas (JSON Schema)
│   ├── skater.jsonc
│   ├── lesson.jsonc
│   ├── invoice.jsonc
│   └── profile.jsonc
├── connectors/            # OAuth integrations
│   └── gmail.jsonc        # Sends invoice PDFs from the coach's Gmail
└── functions/             # Serverless functions (Deno)
    └── send-invoice/      # Generates PDF + sends via Gmail API

src/                       # Frontend
├── App.jsx                # Auth gate, sidebar, routing
├── main.jsx               # Entry point
├── api/base44Client.js    # SDK client
├── pages/                 # Route pages
│   ├── Dashboard.jsx
│   ├── Skaters.jsx
│   ├── Lessons.jsx
│   ├── Invoices.jsx
│   └── Settings.jsx
├── components/ui/         # Buttons, inputs, etc.
└── lib/                   # Shared utilities (format helpers, invoice recalc)
```

## Local development

Two terminals, both long-running. Backend changes go to a local in-memory sandbox — production data is NOT touched.

**Terminal 1 — backend dev server:**

```bash
base44 dev
```

This runs functions as local Deno processes (auto-reload on save) and keeps entities in an in-memory DB. Auth and the Gmail connector are forwarded to your deployed Base44 app so login and email sending still work. Data is wiped every time you stop the server — re-seed test skaters/lessons each session.

**Terminal 2 — frontend dev server:**

```bash
npm install        # first time only
npm run dev
```

Vite serves the frontend at `http://localhost:5173` with hot module reload. It talks to the local Base44 dev server above, so UI edits appear instantly.

## Deploying to production

**Only run these when you're ready to ship changes to real users.**

```bash
base44 entities push          # Push entity schema changes
base44 connectors push        # Push connector changes (may need OAuth approval)
base44 functions deploy       # Deploy backend functions
npm run build                 # Build the frontend
base44 site deploy -y         # Publish the built frontend

# Or all at once:
base44 deploy
```

Live URL: https://lesson-tracking.base44.app

## Useful CLI commands

| Command | What it does |
|---|---|
| `base44 whoami` | Show current Base44 account |
| `base44 dashboard open` | Open the app's Base44 dashboard in the browser |
| `base44 logs` | Tail recent function logs |
| `base44 exec` | Pipe a `.ts` script via stdin to run server-side with the SDK pre-authenticated |
| `base44 entities pull` | Pull current entity schemas from Base44 to local |
| `base44 connectors list-available` | See all available OAuth integrations |
| `base44 secrets set KEY=value` | Set an environment variable for functions |

## Architecture notes

- **RLS (row-level security):** every entity has rules scoped by `created_by: {{user.email}}` so each coach only sees their own data.
- **Invoice totals** live on the Invoice record (`subtotal`, `tax_amount`, `total`) but are recomputed from the linked Lessons whenever a lesson is edited, and also re-checked inside the `send-invoice` function before the PDF is rendered — so the sent PDF is always current.
- **PDF generation** uses [`pdf-lib`](https://pdf-lib.js.org/) inside the `send-invoice` Deno function; bytes are built in memory, wrapped in a multipart MIME message, base64url-encoded, and POSTed to the Gmail API using the OAuth token from the `gmail` connector.
- **Auth:** handled by Base44 (Google OAuth). The frontend gates routes behind `base44.auth.me()`.

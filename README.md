# Lesson Tracking

A skating-coach invoicing app — manage skaters, log lessons, generate PDF invoices, and email them via the coach's own Gmail account. Built on [Base44](https://base44.com) (backend + hosting) and React + Vite (frontend).

**Live URL:** https://lesson-tracking.base44.app

## Features

- **Skaters** — add, search, edit profiles (name, optional billing name, multiple billing emails, default hourly rate, notes).
- **Lessons** — log sessions on a color-coded week/day calendar. Types: Private, Semi Private, Competition, Choreography, Off-Ice Training, Expenses. Supports multiple skaters per lesson (semi-private, off-ice) with per-skater cost splitting. Hourly or flat pricing.
- **Invoices** — generate per-skater invoices from uninvoiced lessons for a single month, a multi-month range, or a custom date range (e.g. weekly billing). Supports tax rate, Mark Paid/Pending, Preview PDF, and Send via Gmail.
- **PDF invoice** — coach header, bill-to, itemized lessons with per-skater rate + amount, subtotal, optional tax, total, and payment instructions.
- **Auto-recalc + drift alert** — if a lesson on a sent invoice is later edited, the invoice totals recompute automatically and a banner appears on the Invoices page flagging that the recipient's copy is out of date.
- **Data backup** — download Skaters and Lessons as CSV files; import CSVs back to rebuild data.
- **Mobile / iOS / iPad** — responsive layout with hamburger drawer on phones, safe-area-aware padding, bottom-sheet-style modals, horizontally-scrollable week calendar.

## Project structure

```
base44/                    # Backend, managed by the Base44 CLI
├── config.jsonc           # Project settings
├── auth/                  # Auth config (Google login)
├── entities/              # Data schemas (JSON Schema)
│   ├── skater.jsonc
│   ├── lesson.jsonc
│   ├── invoice.jsonc
│   └── profile.jsonc
├── connectors/            # OAuth integrations
│   └── gmail.jsonc        # Sends invoice PDFs from the coach's Gmail
└── functions/             # Serverless functions (Deno)
    └── send-invoice/      # Generates PDF + sends via Gmail API

src/                       # Frontend (React + Vite)
├── App.jsx                # Auth gate, sidebar/drawer, routing
├── main.jsx               # Entry point
├── api/base44Client.js    # SDK client
├── pages/                 # Route pages
│   ├── Dashboard.jsx
│   ├── Skaters.jsx
│   ├── Lessons.jsx
│   ├── Invoices.jsx
│   └── Settings.jsx
├── components/
│   ├── ui/                # Buttons, inputs, checkbox
│   └── DataBackup.jsx     # CSV export/import card
└── lib/                   # Format helpers, CSV parser, invoice recalc
```

## Deployment

Iteration is deploy-based — there's no working local dev loop, so every change ships to the live URL. The `base44 dev` command is available but the cross-origin session flow between Vite (`:5173`) and the Base44 dev server (`:4400`) did not authenticate cleanly in our setup, so we stayed on the deploy-to-test cycle.

```bash
# One-time setup per machine
npm install -g base44@latest
base44 login

# From this project folder:
npm install                        # first time only

# Ship a change
base44 entities push               # if entity schemas changed
base44 connectors push             # if connectors changed (may open browser for OAuth)
base44 functions deploy            # if backend functions changed
npm run build && base44 site deploy -y    # if frontend changed

# Or all at once:
base44 deploy --yes
```

## Useful CLI commands

| Command | What it does |
|---|---|
| `base44 whoami` | Show current Base44 account |
| `base44 dashboard open` | Open the app's Base44 dashboard in the browser |
| `base44 logs` | Tail recent function logs |
| `base44 exec` | Pipe a `.ts` script via stdin to run server-side with the SDK pre-authenticated |
| `base44 connectors list-available` | See all available OAuth integrations |
| `base44 secrets set KEY=value` | Set an environment variable for functions |

## Architecture notes

- **Auth:** Google OAuth handled by Base44. The frontend gates routes behind `base44.auth.me()`; RLS on every entity (`created_by: {{user.email}}`) scopes data per coach.
- **PDF generation:** `pdf-lib` in the `send-invoice` Deno function builds the PDF in memory — no file on disk — with coach header, bill-to, an itemized line-items table, subtotal/tax/total, and payment instructions.
- **Email sending:** the function fetches a Gmail OAuth access token via `base44.asServiceRole.connectors.getConnection("gmail")`, wraps the PDF bytes in a multipart MIME message with the coach's email as the `From`, base64url-encodes it, and POSTs it to `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`. The email goes out from the coach's actual Gmail account — recipients see it identically to a hand-typed email.
- **Multi-skater lessons:** a lesson stores `skater_ids` (array) and `invoice_mapping` (`{ skater_id: invoice_id }`). The per-skater cost is `(duration × hourly_rate) / n_skaters` for hourly, or `flat_rate / n_skaters` for flat.
- **Invoice totals** are stored on the record for display speed but recomputed from the current lesson records on every edit AND again server-side just before a PDF is rendered — so sent/preview PDFs are always current.
- **Drift alert:** `Invoice.recalculated_at` is stamped when totals actually change. If it's later than `Invoice.sent_at`, the UI flags the invoice as out of date and prompts a resend.

## Cost

Running on Base44's free tier. The only platform-specific thing we pay attention to is that creating/sharing a Base44 custom domain, enabling GitHub 2-way sync, or hiding the "Edit with Base44" badge all require a paid plan — but none are needed to run the app end-to-end.

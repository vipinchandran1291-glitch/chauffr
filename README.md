# Chauffr

On-demand drivers for the customer's own car, starting in Bangalore.

```
apps/server     Fastify API, SQLite (better-sqlite3 + Drizzle)
apps/customer   Customer PWA          http://localhost:5173
apps/driver     Driver PWA            http://localhost:5174
apps/admin      Admin dashboard       http://localhost:5175
packages/shared Types, pricing, validation, API client (used by server and apps)
packages/ui     Shared React pieces: session, Google sign-in, layout, styles
deploy/         Nginx, systemd and backup files for the VPS
```

## Run locally

Needs Node 22+.

```sh
npm install
cp apps/server/.env.example apps/server/.env   # then edit it
npm run dev                                    # API + all three apps
```

With `DEV_LOGIN=1` in `apps/server/.env`, each app shows an email-only sign-in so you can test without Google.
Any email in `ADMIN_EMAILS` can sign into the admin app.

Other commands: `npm test`, `npm run typecheck`, `npm run build`.

### Google sign-in

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Web application.
2. Authorized JavaScript origins: `http://localhost:5173`, `http://localhost:5174`, `http://localhost:5175`, plus your production domains.
3. Put the client ID in `GOOGLE_CLIENT_ID` in `apps/server/.env`. The apps read it from `/api/config`.

One Google account has one role. Someone who is both a customer and a driver needs two accounts.

## Database

Tables are defined in `apps/server/src/db/schema.ts`. Migrations are applied automatically when the server starts.
After changing the schema, run `npm run db:generate` and commit the new file in `apps/server/drizzle/`.

Money is stored as integer paise and time as epoch milliseconds. Each booking stores a copy of the rate card it was priced with.
The fare formula lives in `packages/shared/src/pricing.ts`.

## Deploy (Ubuntu VPS)

```sh
sudo apt install -y nginx certbot python3-certbot-nginx sqlite3
# Node 22+ from NodeSource or nvm
sudo useradd -r -m -d /srv/chauffr chauffr
sudo -u chauffr git clone <repo> /srv/chauffr && cd /srv/chauffr
sudo -u chauffr npm ci && sudo -u chauffr npm run build
sudo -u chauffr cp apps/server/.env.example apps/server/.env   # set GOOGLE_CLIENT_ID, ADMIN_EMAILS; remove DEV_LOGIN
sudo cp deploy/chauffr.service /etc/systemd/system/ && sudo systemctl enable --now chauffr
sudo cp deploy/nginx.conf /etc/nginx/sites-available/chauffr   # edit domains, then follow the comments in the file
```

To update: `git pull && npm ci && npm run build && sudo systemctl restart chauffr`.
Set up `deploy/backup.sh` as a nightly cron job.

## Roadmap

1. **Foundation** (done): monorepo, schema, Google sign-in with roles, phone number, cars, driver details and approval.
2. Booking flow: book now or later, broadcast to matching drivers, manual assignment, start OTP, end trip, fare.
3. Payments: Razorpay checkout and webhooks, cash, driver ledger, weekly payouts.
4. Driver onboarding: document upload, phone OTP verification, push notifications.
5. Pilot with 10–20 verified drivers.

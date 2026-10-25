# Chauffr

On-demand drivers who drive the customer's own car. Launch city: Bengaluru.

## Layout

| Path | What |
| --- | --- |
| `apps/server` | Node API (Hono, built-in `node:sqlite`, Google sign-in) |
| `apps/customer` | Customer PWA: cars, booking, trips (port 5173) |
| `apps/driver` | Driver PWA: onboarding, online toggle, start/end trips (port 5174) |
| `apps/admin` | Ops dashboard: approve drivers, assign bookings, rate card (port 5175) |
| `packages/shared` | Types, pricing and validation used by server and apps |
| `packages/ui` | Shared React pieces: API client, sign-in, layout, styles |

## Run locally

Requires Node 24+.

```bash
npm install
cp apps/server/.env.example apps/server/.env   # then set ADMIN_EMAILS
npm run dev
```

With `DEV_LOGIN=true` you can sign in with any email. Emails in `ADMIN_EMAILS`
can only use the admin dashboard. To use real Google sign-in, set
`GOOGLE_CLIENT_ID` and add `http://localhost:5173`, `:5174` and `:5175` as
authorized JavaScript origins on the OAuth client.

```bash
npm test         # pricing + API flow tests
npm run typecheck
npm run build    # builds the three apps into apps/*/dist
```

## Production (VPS)

Live at `https://chauffr.vipinlabs.tech` (customer), `/driver/` and `/admin/`, behind Caddy.

| What | Where on the server |
| --- | --- |
| Code | `/srv/chauffr` (user `chauffr`) |
| Settings | `/etc/chauffr/env` |
| Database | `/var/lib/chauffr/data/chauffr.db` |
| Backups | `/var/lib/chauffr/backups`, nightly 03:00 IST, 14 days kept |
| Caddy site | `/etc/caddy/sites/chauffr.caddy` |
| API service | `systemctl status chauffr`, logs: `journalctl -u chauffr` |

To ship new code, push to `main` then on the VPS run `/srv/chauffr/deploy/deploy.sh` as root.
After editing `/etc/chauffr/env`, run `systemctl restart chauffr`.

## How a booking works

1. The customer adds a car (manual/automatic matters) and requests a driver for N hours.
   The fare estimate comes from the current rate card, which is saved onto the booking.
2. Ops assigns an approved driver who can drive that transmission and is free at that time.
3. The customer sees the driver and a 4-digit start code. The driver enters it to start the trip.
4. The driver ends the trip. The fare is billed from actual start/end time: minimum hours,
   then per extra hour after a grace period, plus a night charge if any part falls
   between 22:00 and 06:00 IST. Chauffr's commission is split out of the total.

Money is stored as integer paise everywhere.

## Not built yet

- Razorpay payment at trip end and the driver payout ledger
- Drivers accepting trips themselves, web push notifications
- Production deploy (nginx, systemd, backups)
- Driver document uploads; ops currently checks documents offline

# s.at — Short, self-destructing pastes

A short-URL pastebin built with **Next.js 16 (App Router) + TypeScript + Drizzle ORM + PostgreSQL**. Users paste text and receive a short, typable URL. Pastes can expire, be protected by a password, or self-destruct after a single read.

## Features

- **Short URLs** — auto-generated base62 codes (e.g. `s.at/RcmR6m`), no redirect; the short URL renders the content directly.
- **Server-side encryption** — AES-256-GCM. Each paste gets a random 256-bit key that is wrapped ("encrypted at rest") with a `PASTE_MASTER_KEY` before being stored, so a raw DB dump is not plaintext-readable.
- **Optional password protection** — content key is derived from the password via scrypt (per-paste random salt).
- **Expiration** — 1h / 24h / 7d / 30d / never.
- **Burn after reading** — deletes the paste immediately after it is first revealed (explicit "reveal" step prevents preview bots from burning pastes).
- **Rate limiting** — create + read limits via Upstash Redis (per-IP, sliding window).
- **Security headers** — `no-referrer`, `nosniff`, `X-Frame-Options: DENY`.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.3.3 (App Router), TypeScript |
| UI | Tailwind CSS v4 |
| ORM | Drizzle (+ postgres.js driver, drizzle-kit migrations) |
| Database | PostgreSQL (remote) |
| Crypto | Node `crypto` — AES-256-GCM, scrypt, master-key wrapping |
| Short codes | nanoid (base62, length 6) |
| Rate limiting | @upstash/ratelimit + @upstash/redis |
| Validation | Zod |
| Deploy | Vercel (+ Vercel Cron for cleanup) |

## Getting started

### 1. Install

```bash
pnpm install
```

> This repo uses **pnpm** as the package manager and **Next.js 16.3.3** with the latest
> tooling (TypeScript 7, ESLint 10). Note: `next lint` may be incompatible with the
> bleeding-edge `typescript-eslint` until it supports TS 7; typecheck and build are the
> source of truth.

### 2. Configure environment

Create `.env.local` (see `.env.example`):

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
PASTE_MASTER_KEY=<long random string; e.g. `openssl rand -hex 32`>
APP_URL=http://localhost:3000
UPSTASH_REDIS_REST_URL=       # optional — rate limiting
UPSTASH_REDIS_REST_TOKEN=
CRON_SECRET=                   # guards the cleanup endpoint
```

> **PASTE_MASTER_KEY must stay constant** across deploys, or stored pastes can no longer
> be decrypted. Keep it secret.

### 3. Migrate the database

```bash
pnpm drizzle-kit generate   # create a migration from schema changes
pnpm drizzle-kit migrate    # apply migrations to the DB
```

### 4. Run

```bash
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build (includes typecheck) |
| `pnpm start` | Start production server |
| `pnpm lint` | ESLint (may require pinning TS to <7) |
| `npx tsc --noEmit` | Type-check only |
| `pnpm drizzle-kit generate` | Generate DB migration |
| `pnpm drizzle-kit migrate` | Apply DB migrations |
| `pnpm drizzle-kit push` | Dev-only: push schema without migration |

## Architecture

### Flow

1. **Create** — `POST /api/pastes` validates input, encrypts content with AES-256-GCM
   using a random key (or a scrypt-derived key when password-protected), wraps the key
   with the master key, and stores ciphertext + metadata under a generated short code.
   Returns `{ code, url }`.
2. **Read** — the user opens `/[code]`. For password-protected pastes a gate is shown;
   the client posts the password to `/api/pastes/[code]/verify`. For all other pastes,
   the client posts to `/api/pastes/[code]/reveal`. The server unwraps/derives the key,
   decrypts, enforces expiry and burn-after-read, and returns the plaintext.

### Data model

```
pastes
  code           varchar(12) PK      # short URL code
  ciphertext     bytea              # AES-GCM ciphertext
  iv             bytea              # GCM IV
  auth_tag       bytea              # GCM auth tag
  key_wrapped    bytea              # content key, encrypted with PASTE_MASTER_KEY
  salt           bytea              # scrypt salt (password-protected only)
  kdf_iterations int
  burn_after_read boolean
  consumed       boolean
  created_at     timestamptz
  expires_at     timestamptz
  views          int
```

### Rate limiting

- Create: 20 / 10 s per IP
- Read:   60 / 60 s per IP

When Upstash env vars are absent, rate limiting is disabled (fine for local dev).

### Cleanup

`/api/cron/cleanup` deletes expired pastes. Configured in `vercel.json` (hourly), guarded
by a `Bearer CRON_SECRET` check. Expiry is also enforced lazily on every read.

## Security notes

- This is a **server-side** encryption model (Option A): the server holds the master key
  and can decrypt content. It is NOT zero-knowledge like PrivateBin — trade-off chosen for
  short, typable URLs.
- Ciphertext is encrypted at rest with a per-paste key that is itself wrapped by a master
  key stored only in env.
- Reveal/verify responses set `no-referrer`; content is always rendered through React's
  text-escaping (never `dangerouslySetInnerHTML`).

## Deployment (Vercel)

1. Push to GitHub and import into Vercel, or `vercel --prod`.
2. Set all env vars in the Vercel project settings.
3. Keep `PASTE_MASTER_KEY` identical on every environment.
4. Cron runs automatically via `vercel.json`.

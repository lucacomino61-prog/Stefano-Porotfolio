# stefano-portfolio

A scroll-driven portfolio for Stefano Doko, web designer and developer. Three
languages, a WebGL hero, and a real backend.

The visual direction is recorded in [DESIGN.md](DESIGN.md) and the product
context in [PRODUCT.md](PRODUCT.md). Read those before changing anything
visual: they carry decisions that are expensive to rediscover, including
several that were reversed after being measured.

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind v4 · GSAP + ScrollTrigger
· Lenis · React Three Fiber · Drizzle + Neon Postgres · Zod · Resend · Upstash

## Running it

```bash
npm install
cp .env.example .env.local
npm run dev
```

The site renders without any environment variables. The parts that need them
fail gracefully rather than taking the page down:

| Variable | Needed for | Without it |
| --- | --- | --- |
| `DATABASE_URL` | contact form, projects, admin | form returns a server error |
| `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` | enquiry email | submission is stored, not emailed |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | rate limiting | in-memory limiter in dev; **the build refuses to start in production** |
| `ADMIN_SESSION_SECRET` | admin session, contact time-trap | contact form and `/admin` reject everything |
| `ADMIN_PASSWORD_HASH` | admin login | `npm run hash-password -- "your password"` |
| `IP_HASH_SALT` | salted visitor hashing | hashes are skipped |

## Deploying

`vercel.json` pins `framework: nextjs`, and it is not decoration. With the
preset left at *Other*, Vercel still runs `npm run build` and still reports the
deployment green, but it publishes `public/` — the default output directory for
a project with no framework — so every asset under `public/` serves correctly
while every page, route handler and `_next/static` asset returns a platform 404.
A deployment that is broken in exactly that way looks healthy from the build log,
so the setting lives in the repository where it can be read.

Settings in `vercel.json` take precedence over the dashboard. If pages still 404
after a deploy, check that **Output Directory** is not separately overridden in
project settings.

The site renders with no environment variables at all, but two are needed before
the contact form works in production:

| Variable | Without it |
| --- | --- |
| `ADMIN_SESSION_SECRET` | the form's time-trap token cannot be signed, so every submission is rejected |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | `/api/contact` throws on the first request: production must never run unmetered |
| `DATABASE_URL` | submissions have nowhere to be stored |

## Scripts

```bash
npm run typecheck    # tsc --noEmit
npm run lint
npm run build
npm run db:generate  # drizzle-kit migrations
npm run db:seed      # reads content/projects.json
npm run hash-password -- "your password"
npx tsx scripts/contrast.ts   # contrast table for both sheets
```

## Routes

`/it`, `/en`, `/al` are the three locales. Albanian is served at `/al` because
visitors recognise it, while the language tag stays `sq` throughout: `al` is a
country code, `sq` is the language. Anything emitting a language reads the map
in `lib/i18n/config.ts` rather than the URL segment.

`/[locale]/admin` lists contact submissions behind a signed cookie.
`/api/contact`, `/api/projects`, `/api/events` are the route handlers.

## What is deliberately missing

**There is no case study.** The two live sites are shown, linked and described,
but nothing claims a client, an outcome, a metric or a date it cannot support.
`npm run db:seed` still refuses to run on invented data.

## The monitor

The first screen and the walk toward the workstation are one pinned section,
[components/sections/Cinema.tsx](components/sections/Cinema.tsx). Scroll drives a
camera in `WorkstationScene`, not a CSS transform: the position travels through
[lib/motion/cinema.ts](lib/motion/cinema.ts) and is read inside the frame loop,
so the scene never re-renders to move. As the panel fills the frame a real DOM
interface crossfades over it, and from there the switcher and both links are
ordinary HTML.

Project data lives in one place, [lib/projects.ts](lib/projects.ts); the
translated copy for each project sits under `work.projects` in the dictionary.
The 3D room and its 38MB of models are desktop-only and are never fetched below
1024px or under reduced motion.

## Day and night

The page is printed on one of two sheets and the hour picks: light from 07:00
to 19:00 local, dark either side. The switch in the apparatus row overrides the
clock, and the override is stored against the automatic value it was chosen
against — so it holds for the situation that prompted it and lapses once the
clock moves on. An inline `beforeInteractive` script sets the attribute ahead of
the first paint, so no visitor watches the page turn over on load.

Colours are roles, split across `:root` and `:root[data-theme='light']` in
[app/globals.css](app/globals.css). Anything drawn on a slate reads from the
`--slate-*` roles, which do not change with the sheet.

```bash
npx tsx scripts/contrast.ts   # the contrast table for both sheets
```

## Sound

The sound switch in the first viewport plays `public/audio/room-tone.wav` on a
loop. That file is a placeholder: a generated room tone, the low bed a sound
recordist captures so the silences in a cut match the takes around them. Drop a
real track in its place and change `SRC` in
[components/ui/SoundToggle.tsx](components/ui/SoundToggle.tsx).

It never autoplays, and `preload="none"` keeps it off the wire until someone
asks for it, so the half megabyte is not part of any page load.

## Fonts

Archivo and Martian Mono are vendored in `app/fonts/`. See
[app/fonts/README.md](app/fonts/README.md) for attribution and licensing.

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Pinned by the user, not delegated: Next.js (App Router) + TypeScript strict; Tailwind CSS
v4 with CSS-variable design tokens; GSAP + ScrollTrigger for scroll choreography; Lenis for
smooth scroll; React Three Fiber + drei for the WebGL layer; Next.js Route Handlers with Zod
validation; Postgres (Neon) + Drizzle; Resend for transactional email; Upstash for rate
limiting. Package manager npm. Deploy target Vercel.

## Users

**Primary: prospective clients commissioning work.** Founders, marketing leads and small
studios deciding whether to hire Stefano Doko for a project. They arrive from a referral or a
link, want to believe he can execute, and need an obvious way to start a conversation. Their
visit ends at the contact form or it ends nowhere.

**Secondary: design directors and creative leads at studios**, evaluating him for a role or
a freelance contract. They scan for craft depth and want evidence of process and code
quality, not only finished outcomes.

The site is built for the first audience first; the second must still find its depth.

## Product Purpose

A personal portfolio for Stefano Doko, a web designer and developer. Success is a qualified
enquiry: a visitor who understands what he does, believes he can do it, and sends a message.
Not traffic, not time on page.

## Positioning

He designs and builds end to end. One person takes a project from concept and art direction
through to shipped production code, so nothing is handed off and nothing is lost in
translation. A studio that only designs, or a developer who only implements, cannot
truthfully make this claim.

## Operating Context

Three languages: Italian, English and Albanian. URL segments are `/it`, `/en` and `/al`;
the Albanian language tag is `sq` (`al` is a country code, kept in the URL for
recognisability only). No language is a translation afterthought.

## Capabilities and Constraints

- Contact form persists to Postgres and sends transactional email; protected by a honeypot,
  a submission time-trap and per-IP rate limiting.
- Projects are served from the database, with a seed script.
- A private admin route lists submissions, gated by an environment secret and a signed
  httpOnly cookie.
- A first-party analytics endpoint records section-view events. No third-party tracker.
- Performance budget, treated as a hard limit and measured rather than assumed: LCP under
  2.5s, CLS under 0.1, INP under 200ms on mid-range mobile; initial JS under 200KB gzipped;
  the WebGL layer never in the first-load bundle; device pixel ratio capped at 2.
- **Undecided:** the domain and the contents of the project list.

## Brand Commitments

The user pinned one tonal constraint, recorded verbatim and not expanded here: **editorial,
cinematic, minimal-luxury**. The name shown on the site is **Stefano Doko**. No logo, wordmark,
colour or typeface has been supplied.

## Evidence on Hand

**Two shipped sites, supplied 2026-09-01:** `elixir.al` (luxury perfume
e-commerce) and `barmartiri.com` (hospitality). Both are live and both are the
user's own work end to end. Their palettes, headlines and hero imagery in
`lib/projects.ts` were read off the running sites rather than invented, which is
what lets the monitor claim to be showing them. The work section exists as of
this date; the case study still does not.

**Everything else below predates them.** The user has confirmed real projects with images
and links are coming but has not supplied them. Until they arrive:

- No project title, client name, outcome, metric, year, role or link may be invented or
  stated as fact anywhere in the codebase or the interface.
- The WORK and CASE STUDY sections are deliberately unbuilt, not stubbed with plausible
  fiction.
- Any placeholder that does ship is labelled synthetic in the code and listed for
  replacement.

## Product Principles

1. **The work leads.** The visitor came to see what he made. Interface, motion and
   typography carry the work; they never compete with it.
2. **Motion must be motivated.** Every animation answers hierarchy, storytelling, feedback
   or state change. Motion that only decorates is removed, not tuned.
3. **The contact path is never more than one gesture away.** The site's only conversion is a
   message, and no amount of choreography may bury it.
4. **Nothing claimed is unproven.** Copy states only what the supplied evidence supports.
5. **The reduced-motion experience is a first-class build, not a degradation.** With motion
   off the site is still complete, still legible, still navigable.

## Accessibility & Inclusion

WCAG AA is the floor: contrast measured rather than assumed, semantic landmarks, correct
heading order, alt text. Full keyboard operation including the horizontal work gallery,
visible focus states, and a skip-to-content link. `prefers-reduced-motion` is a full kill
switch: content becomes static, sections unpin, scroll-jacking stops, and everything remains
reachable.

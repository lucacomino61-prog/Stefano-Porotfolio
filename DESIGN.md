# Design

<!-- impeccable:design-record 1 -->

Recorded from the built world, not from intention. Where a value here disagrees
with the code, the code is right and this file is stale.

## The world

**The camera report.** Not a film: the paperwork of a shoot. Camera reports, lab
orders, slate boards, edit decision lists, timecode. The industrial substrate
under the glamour, which is where "cinematic" lives without becoming pastiche.

It was chosen because of what a camera report *is*: the one document filled by
one hand on set that travels to the lab and into the edit suite, keeping the
shot intact across every handoff. That is the product's mechanism made literal,
which is why this world and not a prettier one.

**Colour, and where it is allowed to be.** The ground is a graded room rather
than a flat field: `--ground`, `--ground-raised` and `--ground-sunk`, with each
section carrying its own wash through `.atmos`. Accents arrive as light, not as
fill — electric blue is the site's own and carries interaction; violet, cyan,
coral and gold belong to sections and to projects. One at a time, never a
palette on parade. The rule that keeps this from becoming decoration: a colour
has to be either a state (the active nav item, focus, a live link) or a light
source (an atmosphere, a glow, a lamp in the 3D room). It is never a shape.

**Lines were the problem, so most of them went.** The dashed focusing-screen
grid over the hero and the ruled stock behind the contact form are both gone.
They were texture standing in for composition, and at hairline weights on a
dark ground they read as artefacts rather than as ruling. What is left is
structural: section dividers, the metadata rules in the work section, the
underline on the active nav item, and the project numerals. A line has to
separate two things that are genuinely different, or it is lighting's job.

**Grain is rendered, not tiled.** One `feTurbulence` over the viewport in
`components/ui/Grain.tsx`. A repeated noise bitmap shows its seams at exactly
the scale it would be used at, shows them worst across the large flat areas it
exists to break up, and resolves at one pixel density.

**Two sheets, decided by the hour.** The report sheet under room light from
seven to seven, the grading suite with the lights down either side of it, and a
switch in the apparatus row that overrides the clock until the clock next
disagrees with it — a preference set at four in the afternoon should not still
be running at midnight. The earlier light variant was reverted because it kept
the canary as the accent and canary on bone measures 1.3:1. The canary is a
highlighter and a highlighter is a fill, so it stays the accent on the night
ground and the day ground takes a marker ink instead. Every pair is measured;
`npx tsx scripts/contrast.ts` prints the table and exits non-zero on a
regression. The slate is the one thing that does not turn over: a slate is a
dark board with light lettering under any light, and anything set on one reads
from `--slate-ink`, never from `--ink`.

**Refused, by name:** the cream ground with a high-contrast display serif and
hairline rules, and its predictable opposite, the black void with one neon
accent and glowing edges. Both are the category default for a designer
portfolio. Neither may be reintroduced piecemeal.

## Ground

One ground, committed. A film gate is a dark object: a rectangle of light in a
dark room. `color-scheme: dark` is declared so scrollbars, form fields and
autofill match the page.

A light variant was built and then removed. It is recorded here so it is not
attempted again without new information: the gate flattened into a cream field
and canary ink on bone stock measured about **1.3:1**, which fails AA outright
rather than marginally.

## Palette

All tokens live in `app/globals.css`. Components reference roles, never hues.
Ratios below were measured in the browser against `--ground`.

| Token | Value | Role | Measured |
| --- | --- | --- | --- |
| `--ground` | `#0b0b0c` | page ground. Never `#000`: pure black has no depth | ground |
| `--ground-raised` | `#141416` | the plane a sheet sits on | |
| `--ink` | `#efede6` | primary type, warm paper against a cool ground | **16.8:1** |
| `--ink-muted` | `#9a968b` | secondary type, tinted from the paper, never grey | **6.7:1** |
| `--rule` | `#2a2a2d` | hairline ruling | |
| `--rule-strong` | `#46464a` | aperture marks | |
| `--mark` | `#e8d34b` | NCR canary. The circled take | **12.5:1** |
| `--mark-ink` | `#0b0b0c` | type sitting on a canary field | |
| `--confirm` | `#9dbe6a` | lab-order green. One job: a confirmed state | |
| `--alert` | `#e07a5f` | correction red. One job: an error | |
| `--gate` | `#050506` | inside the aperture, darker than the page | |

`--ink-muted` is the quietest tone that clears 4.5:1. Nothing may be dimmed
below it with opacity. See **Emphasis** below.

## Type

Two families, both variable, both self-hosted from `app/fonts` via
`next/font/local`. They are vendored rather than fetched from Google because
`fonts.googleapis.com` is not reachable from the build machine, and vendoring
also removes an external dependency from the build and from runtime.

- **Archivo** (wght 100-900, wdth 62-125), display and text. A grotesque drawn
  for printed forms. The width axis is declared on the `@font-face`; without it
  the browser ignores `font-stretch` and the display face is just another
  grotesque.
- **Martian Mono** (wght 100-800), timecode, tabular figures, apparatus labels,
  and the slates in the first viewport. The name moved onto the mono when the
  hero became a stack of slates: a slate is lettered by hand in even widths, and
  the name reads as one of the readings taken off the equipment rather than a
  headline set above them.
  Its metric fallback adjustment is deliberately off, because adjusting a
  monospace against Arial's metrics shifts the columns it exists to align.

Both are the latin subset only, which covers the whole alphabet this site
needs: Albanian's ç and ë and every Italian accent live in U+0000-00FF.

No serif anywhere. The brief says editorial; the form's own lettering is
engineered, not literary.

## Shape

**No radius on anything that holds content.** A ruled form has none: no card,
panel, field, button or image gets a corner.

The system has exactly two curves, and both are marks rather than containers:
the **circled take**, and the **follower**'s ring. Each is an empty stroke that
carries nothing, which is the discriminator. If a new curve appears on
something with children, a background, or a border that encloses text, it is a
container and the lock applies.

## Layout

One gutter token, `--gutter: clamp(1.25rem, 4vw, 3.5rem)`, used on every
section. Body measure `68ch`. The rail is `--rail: 7.5rem`, sized to fit
`00:00:00:00` and the longest scene label without truncating.

Pins are disabled below **1024px**, where the rail becomes a 2.75rem top strip
and `main` carries matching padding. Any full-height section must therefore
subtract that strip: `min-h-[calc(100svh-2.75rem)] lg:min-h-svh`.

## Motion

Durations are frame counts at 24fps, because the world runs at 24fps:
`--f4: 167ms`, `--f6: 250ms`, `--f10: 417ms`, `--f15: 625ms`.

Easing is exponential ease-out from an already-visible default
(`cubic-bezier(0.23, 1, 0.32, 1)`). Never `ease-in`.

**One loop.** `gsap.ticker` is the application's only requestAnimationFrame.
Lenis is driven from it, the canvas runs `frameloop="never"` and is advanced
from it, and the timecode rail subscribes to it. Anything calling
`requestAnimationFrame` directly is a bug.

**Reduced motion is a build, not a degradation.** Lenis is never constructed,
the canvas never mounts, and `gsap.matchMedia` creates no ScrollTriggers at all.

## Emphasis

**Carried by colour, never by dimming.** This is a hard rule and it came from a
measurement: dimming inactive process rows to 45% put them at about **2.3:1**,
and because all five rows are on screen for the whole pinned section, four of
them would have sat permanently below AA.

The same applies to scrubbed reveals. A scrub has no transient states: the
reader can stop anywhere and stay there, so every value the scrub can hold must
be legible. The manifesto's unrevealed word floor is `0.45`, about 3.9:1, which
clears AA for text that size.

## Components

- **Circled take** (`CircledTake`, and the contact submit). The primary action,
  marked the way an assistant circles the take worth printing. The ring is
  present at rest; hover and focus *fill* it. A control that looks like plain
  text until you touch it has no affordance.
- **Timecode rail** (`TimecodeRail`). Navigation and scroll progress in one
  object, because in this world they are one object. Scenes come from
  `lib/sections.ts` so the nav renders on the server and cannot link to a
  section that does not exist.
- **The gate** (`HeroGate`). A fullscreen shader. `uShutter` is the shutter
  angle driven by scroll velocity: scroll fast and the grain smears, stop and it
  resolves. Grain steps at 24fps, not per frame. Colours are passed as sRGB
  floats and written straight out, because `ShaderMaterial` gets no colorspace
  conversion and `THREE.Color` would linearise them into a visibly different
  black from the CSS ground behind it.
- **Ruled fields** (`ContactForm`). Underline only, no boxes, labels in the
  apparatus register above the line. The form is the report sheet.
- **The walk** (`Cinema`, `WorkstationScene`). The first screen and the approach
  to the monitor are one section because they are one camera move. Scroll is a
  distance: `lib/motion/cinema.ts` carries the position, a ScrollTrigger writes
  it, and the camera reads it inside the frame loop, so moving the camera
  re-renders nothing. The end distance is solved from the panel's world size
  every frame rather than typed in, which is what makes it correct at every
  aspect ratio. The panel shows each project's own hero image, headline and
  palette drawn into a canvas texture; the lamp beside it takes the project's
  colour, so switching project relights the room.

  The handover at the end is the point. Up close a texture is useless as an
  interface — a link painted into WebGL cannot be focused, middle-clicked, read
  aloud or translated — so a real DOM interface fades in over the panel it is
  already showing, same composition and same palette, and everything pressable
  from then on is ordinary HTML. Below 1024px and under reduced motion none of
  it runs, and the scene's thirty-eight megabytes are never even fetched.
- **The slates** (`.plate`, in the first viewport). Filled rectangles, each one
  exactly as wide as what is written on it, stacked with a three pixel gap:
  name, role, then the apparatus row of clock, date stamp and sound switch. The
  fill is `--gate` rather than `--ground`, so a slate reads as a hole cut into
  the lit frame and not a card laid on top of it. Padding is set in `em`, which
  is what keeps the proportion identical from the name down to the clock.
  Boxes here and nowhere else: the form below is still ruled, never boxed.
- **The ground glass** (`GridPattern`). A focusing screen is etched with a
  grid, and this is that etching: dashed because it is scribed rather than
  printed, radially masked so it concentrates where the operator frames and
  never reaches the name. The same component rules the contact sheet, denser
  and solid, because a report is printed on ruled stock.
- **The follower** (`Cursor`). A ring in `mix-blend-mode: difference`, so it
  inverts whatever is beneath it and needs no colour of its own. Three states:
  a ring, a larger ring over anything interactive, and a caret over a text
  field. Damped follow plus a stretch along the direction of travel, which is
  what a shutter does to anything crossing the frame.
- **Magnetic**. Wraps a control and pulls it toward the pointer, `quickTo` with
  an `expo.out` ease, springing back on leave.

## Borrowed

Two components come from **Magic UI** (magicui.design), retrieved through the
21st.dev registry. Both are recorded here because a reader should be able to
tell authored work from adapted work.

**Grid Pattern** ships close to source. Two changes: its default
`fill-gray-400/30 stroke-gray-400/30` classes are removed, because grey is
banned here and leaving them would have forced `tailwind-merge` into the
dependency list purely to override them; and its `[key: string]: unknown` prop
spread is dropped, because it let any attribute through onto the SVG including
ones that would override `aria-hidden`.

**Smooth Cursor** was **not** installed. Its behaviour is the reference for
`Cursor.tsx`, but the original is incompatible with this project in four ways,
each of which is a rule recorded above: it imports `motion/react`, which puts a
second animation scheduler beside `gsap.ticker`; it runs its own
`requestAnimationFrame` throttle, a third; it calls `setState` on every mouse
move; and it sets `document.body.style.cursor = "none"` with no `(hover: hover)`
guard, so touch users lose their pointer. It also leaks a `setTimeout` per mouse
move, because the clear is returned from an event handler where nothing calls
it. The rewrite derives the reset from velocity in the ticker instead, so there
is no timer to leak.

The lesson generalises: a drop-in animated component carries its own scheduler,
and a project that has committed to one loop can borrow the design but not the
code.

## Banned

- Eyebrows and kickers above headings. The heading carries its own weight.
- Scroll cues. Someone looking at the first viewport knows what scrolling is.
- Em-dashes and en-dashes in any visible string.
- Radius on anything that holds content. See **Shape** for the two marks that
  are not containers.
- Gradients-as-decoration, glow.
- Section numbers, **except** in the process list, where the sequence is the
  information.

## Not built

`WORK` and `CASE STUDY` do not exist. They are absent rather than stubbed with
plausible fiction, because no real projects have been supplied and this site may
not state a client, outcome, metric or date it cannot support. Add them to
`lib/sections.ts` when they land.

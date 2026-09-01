'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { ContactForm } from '@/components/sections/ContactForm'
import { ProjectPanes } from '@/components/ui/ProjectScreen'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { hasFinePointer } from '@/lib/motion/pointer'
import { PROJECTS, type ProjectId } from '@/lib/projects'
import { SCREEN_SECTIONS, type ScreenSection, type ScreenView } from '@/lib/screen'

/**
 * The machine, once you are standing at it.
 *
 * The monitor stopped being a picture of a computer and became the computer:
 * every section of the site is behind a press here, and the page underneath
 * does not scroll while you are here.
 *
 * A section opens in a window over the desktop rather than replacing it, which
 * is the whole difference between a machine and a set of slides. The desktop
 * stays where it was, so opening Process and closing it again puts you back
 * exactly where you pressed rather than somewhere that merely looks like it.
 *
 * One window at a time, deliberately. Stacking, z-order and a task bar are what
 * make an OS an OS, and they are also what make it work: this site's job is to
 * end at the contact form, and asking a prospective client to manage windows on
 * the way there is friction dressed as personality.
 *
 * Nothing scrolls. Sections are a fixed run of screens paged inside the window,
 * which is why the copy in the dictionary is already written as discrete units:
 * five process steps, two projects, a statement and a list.
 */

type Pages = { label: string; body: React.ReactNode }[]

export function ScreenOS({
  work,
  about,
  process,
  contact,
  nav,
  hero,
  locale,
  active,
  onSelect,
  view,
  onView,
}: {
  work: Dictionary['work']
  about: Dictionary['about']
  process: Dictionary['process']
  contact: Dictionary['contact']
  nav: Dictionary['nav']
  hero: Dictionary['hero']
  locale: Locale
  active: ProjectId
  onSelect: (id: ProjectId) => void
  view: ScreenView
  onView: (view: ScreenView) => void
}) {
  const [page, setPage] = useState(0)
  /** The menu item that opened the window, so closing hands focus back to it. */
  const opener = useRef<HTMLButtonElement | null>(null)

  const label: Record<ScreenSection, string> = {
    work: nav.items.work,
    about: nav.items.manifesto,
    process: nav.items.process,
    contact: nav.items.contact,
  }

  // Opening always starts at the first screen. Without this, leaving Process on
  // step four and coming back later drops you at step four with no idea how.
  const open = useCallback(
    (next: ScreenSection, from: HTMLButtonElement | null) => {
      opener.current = from
      setPage(0)
      onView(next)
    },
    [onView],
  )

  const close = useCallback(() => {
    setPage(0)
    onView('home')
  }, [onView])

  const windowed = view !== 'home'

  return (
    <div className="screen-ui screen-desktop">
      {/*
        The desktop stays put behind the window rather than being replaced, and
        goes inert while the window is up. Inert rather than unmounted for the
        same reason it is used twice elsewhere on this stage: it takes the menu
        out of the tab order and the accessibility tree in one attribute, so a
        keyboard visitor is in the window and nowhere else, while the desktop is
        still there to look at and still exactly where they left it.
      */}
      <div className="screen-desk" inert={windowed}>
        {/*
          Applications, not a list of links.
          
          A desktop earns the metaphor by behaving like one: things on it are
          objects you open, laid out in a grid, each with a mark you can learn
          to recognise. The four sections are the installed applications; the
          two shipped sites are shortcuts to somewhere else, which is why they
          are drawn as links and carry the outward arrow.
        */}
        <nav aria-label={nav.sections}>
          <h4 className="label screen-apps-label">{work.apps}</h4>
          <ul className="screen-apps">
            {SCREEN_SECTIONS.map((section) => (
              <li key={section}>
                <button
                  type="button"
                  onClick={(event) => open(section, event.currentTarget)}
                  aria-current={view === section ? 'true' : undefined}
                  className="screen-app"
                >
                  <span className="screen-app-glyph" aria-hidden="true">
                    <AppGlyph section={section} />
                  </span>
                  <span className="screen-app-label">{label[section]}</span>
                </button>
              </li>
            ))}

            {PROJECTS.map((project) => (
              <li key={project.id}>
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="screen-app screen-app-shortcut"
                  title={`${work.openSite}: ${project.host}`}
                >
                  <span
                    className="screen-app-glyph"
                    aria-hidden="true"
                    style={{ '--app-accent': project.screen.accent } as React.CSSProperties}
                  >
                    <SiteGlyph />
                  </span>
                  <span className="screen-app-label">{project.name}</span>
                  {/* A shortcut leaves the machine, and saying so is the whole
                      job of the second line: the icon's arrow is a convention,
                      the host is the fact. */}
                  <span className="screen-app-host">{project.host} ↗</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {windowed ? (
        <ScreenWindow
          title={label[view as ScreenSection]}
          onClose={close}
          closeLabel={work.back}
          opener={opener}
        >
          {view === 'work' ? (
            <div className="screen-work">
              <ProjectPanes dict={work} active={active} />
              <nav className="screen-tabs" aria-label={work.selector}>
                {PROJECTS.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => onSelect(project.id)}
                    aria-current={project.id === active ? 'true' : undefined}
                    className="screen-tab"
                  >
                    <span aria-hidden="true">{project.index}</span> {project.name}
                  </button>
                ))}
              </nav>
            </div>
          ) : (
            <Paged pages={pagesFor(view, { about, process, contact, locale })} page={page} onPage={setPage} nav={nav} />
          )}
        </ScreenWindow>
      ) : null}

      {/* The machine's own bar. It belongs to the desktop, not to a section, so
          it carries identity and nothing that changes with what is open. */}
      <div className="screen-chrome">
        <span className="screen-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="screen-url">{hero.name}</span>
      </div>
    </div>
  )
}

/**
 * One mark per application.
 *
 * Drawn rather than lettered, and geometric rather than pictorial: an icon on
 * this desktop has to survive being a few pixels across on a monitor seen from
 * the other side of a room, which rules out anything with detail in it.
 */
function AppGlyph({ section }: { section: ScreenSection }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  if (section === 'work') {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M3 7.5h7l1.6 2H21v9.5H3z" {...common} />
        <path d="M3 7.5V5h6l1.6 2.5" {...common} />
      </svg>
    )
  }

  if (section === 'about') {
    return (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="8.5" r="3.4" {...common} />
        <path d="M4.8 19.5a7.2 7.2 0 0 1 14.4 0" {...common} />
      </svg>
    )
  }

  if (section === 'process') {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M4 6.5h4M4 12h4M4 17.5h4" {...common} />
        <path d="M12 6.5h8M12 12h8M12 17.5h8" {...common} opacity={0.55} />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24">
      <rect x="3.2" y="5.5" width="17.6" height="13" {...common} />
      <path d="m3.6 6.5 8.4 6.4 8.4-6.4" {...common} />
    </svg>
  )
}

/** A shortcut leaves the machine, so it is drawn as a window with a way out. */
function SiteGlyph() {
  return (
    <svg viewBox="0 0 24 24">
      <rect
        x="3.2"
        y="4.6"
        width="17.6"
        height="14.8"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path d="M3.2 8.6h17.6" stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M10 15.4 15 10.4M15 10.4h-3.4M15 10.4v3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function pagesFor(
  view: ScreenView,
  d: {
    about: Dictionary['about']
    process: Dictionary['process']
    contact: Dictionary['contact']
    locale: Locale
  },
): Pages {
  if (view === 'about') {
    return [
      {
        label: d.about.heading,
        body: (
          <>
            <p className="label screen-page-kicker">{d.about.kicker}</p>
            <p className="screen-statement">{d.about.lede}</p>
          </>
        ),
      },
      {
        label: d.about.capabilitiesLabel,
        body: (
          <ul className="screen-capabilities">
            {d.about.capabilities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ),
      },
    ]
  }

  if (view === 'process') {
    return [
      { label: d.process.heading, body: <p className="screen-statement">{d.process.intro}</p> },
      ...d.process.steps.map((step) => ({
        label: step.label,
        body: <p className="screen-step-body">{step.body}</p>,
      })),
    ]
  }

  if (view === 'contact') {
    return [
      {
        label: d.contact.heading,
        body: (
          <div className="screen-form">
            <p className="screen-page-kicker label">{d.contact.intro}</p>
            <ContactForm dict={d.contact} locale={d.locale} />
          </div>
        ),
      },
    ]
  }

  return []
}

/**
 * One window.
 *
 * The bar is the handle as well as the title, which is the convention every
 * windowing system has agreed on since they existed, so it needs no affordance
 * of its own beyond the cursor.
 *
 * Dragging is for a fine pointer only. On touch the same gesture is how you
 * scroll and how you swipe back, and a window that follows your thumb has taken
 * a gesture the platform already owns. `hasFinePointer` is the same test the
 * cursor and the magnetic buttons use.
 *
 * The move is written straight to the element rather than held in state: a
 * pointer move fires far faster than this tree should re-render, and
 * re-rendering it would re-run the project panes and their images for a
 * translation. The same reasoning as the cursor and the timecode readout.
 */
function ScreenWindow({
  title,
  onClose,
  closeLabel,
  opener,
  children,
}: {
  title: string
  onClose: () => void
  closeLabel: string
  opener: React.RefObject<HTMLButtonElement | null>
  children: React.ReactNode
}) {
  const frame = useRef<HTMLDivElement>(null)
  const closeControl = useRef<HTMLButtonElement>(null)
  const offset = useRef({ x: 0, y: 0 })
  const from = useRef<{ x: number; y: number } | null>(null)

  // Focus opens on the way in and is handed back on the way out. Without the
  // second half, closing leaves focus on a control that no longer exists and
  // the next Tab starts again from the top of the document.
  useEffect(() => {
    closeControl.current?.focus({ preventScroll: true })
    const back = opener.current
    return () => {
      if (back?.isConnected && document.activeElement === document.body) {
        back.focus({ preventScroll: true })
      }
    }
  }, [opener])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Escape closes the window, not the machine. Cinema's own handler is on
      // window and would take you all the way out of the room, so this stops
      // the event before it gets there: one press, one level.
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    const el = frame.current
    el?.addEventListener('keydown', onKey)
    return () => el?.removeEventListener('keydown', onKey)
  }, [onClose])

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!hasFinePointer()) return
    if ((event.target as HTMLElement).closest('button')) return
    from.current = { x: event.clientX - offset.current.x, y: event.clientY - offset.current.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = from.current
    const el = frame.current
    if (!start || !el) return
    const parent = el.parentElement?.getBoundingClientRect()
    const box = el.getBoundingClientRect()
    // Clamped so the bar can never be pushed off its own screen, which is the
    // one way a draggable window becomes unclosable.
    const room = parent
      ? { x: Math.max(0, (parent.width - box.width) / 2), y: Math.max(0, (parent.height - box.height) / 2) }
      : { x: 0, y: 0 }
    const x = Math.max(-room.x, Math.min(room.x, event.clientX - start.x))
    const y = Math.max(-room.y, Math.min(room.y, event.clientY - start.y))
    offset.current = { x, y }
    el.style.transform = `translate(${x}px, ${y}px)`
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    from.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div
      ref={frame}
      className="screen-window"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
    >
      <div
        className="screen-window-bar"
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="screen-window-title">{title}</span>
        <button
          ref={closeControl}
          type="button"
          onClick={onClose}
          className="screen-window-close"
          aria-label={closeLabel}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="screen-window-body">{children}</div>
    </div>
  )
}

/**
 * One section, as a fixed run of screens.
 *
 * The live region is on the screen body rather than the counter: a screen
 * reader should hear the step it has arrived at, not the number of it.
 */
function Paged({
  pages,
  page,
  onPage,
  nav,
}: {
  pages: Pages
  page: number
  onPage: (page: number) => void
  nav: Dictionary['nav']
}) {
  const clamped = Math.min(page, pages.length - 1)
  const current = pages[clamped]
  const body = useRef<HTMLDivElement>(null)

  const go = useCallback(
    (delta: number) => {
      const next = clamped + delta
      if (next < 0 || next >= pages.length) return
      onPage(next)
    },
    [clamped, pages.length, onPage],
  )

  // Focus follows the page so a keyboard visitor reads where the eye is. The
  // body is programmatically focusable only; it never enters the tab order.
  useEffect(() => {
    if (clamped > 0) body.current?.focus({ preventScroll: true })
  }, [clamped])

  if (!current) return null

  return (
    <div
      className="screen-paged"
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') go(1)
        else if (event.key === 'ArrowLeft') go(-1)
        else return
        event.preventDefault()
      }}
    >
      <div ref={body} tabIndex={-1} aria-live="polite" className="screen-page">
        <h4 className="screen-page-title">{current.label}</h4>
        {current.body}
      </div>

      {pages.length > 1 ? (
        <div className="screen-pager">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={clamped === 0}
            className="screen-pager-step"
            aria-label={nav.previous}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="screen-cta-arrow">
              <path
                d="M13 8H3M7 4L3 8l4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <span className="tabular screen-pager-count">
            {String(clamped + 1).padStart(2, '0')}
            <span aria-hidden="true"> / </span>
            <span className="sr-only"> of </span>
            {String(pages.length).padStart(2, '0')}
          </span>

          <button
            type="button"
            onClick={() => go(1)}
            disabled={clamped === pages.length - 1}
            className="screen-pager-step"
            aria-label={nav.next}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="screen-cta-arrow">
              <path
                d="M3 8h10M9 4l4 4-4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  )
}

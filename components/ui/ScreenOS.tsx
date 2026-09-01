'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { ContactForm } from '@/components/sections/ContactForm'
import { ProjectPanes } from '@/components/ui/ProjectScreen'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { PROJECTS, type ProjectId } from '@/lib/projects'
import { SCREEN_SECTIONS, type ScreenSection, type ScreenView } from '@/lib/screen'

/**
 * The machine, once you are standing at it.
 *
 * The monitor stopped being a picture of a computer and became the computer:
 * every section of the site is behind a press on this screen, and the page
 * underneath does not scroll while you are here. That is the whole reason it
 * exists. A phone previously got a 120x60 patch of monitor that scrolled the
 * page down to a 350x219 panel, which is not an interface, it is a thumbnail.
 *
 * Nothing here scrolls either. Sections are a fixed number of screens you page
 * through, which is why the copy in the dictionary is already written as
 * discrete units: five process steps, two projects, a statement and a list.
 * Paging rather than scrolling means every screen is composed at a size the
 * monitor actually has, instead of a column running off the bottom of a bezel.
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

  // Opening a section always starts at its first screen. Without this, leaving
  // Process on step four and coming back later drops you at step four with no
  // idea how you got there.
  const open = useCallback(
    (next: ScreenView) => {
      setPage(0)
      onView(next)
    },
    [onView],
  )

  const label: Record<ScreenSection, string> = {
    work: nav.items.work,
    about: nav.items.manifesto,
    process: nav.items.process,
    contact: nav.items.contact,
  }

  if (view === 'home') {
    return (
      <div className="screen-ui screen-home">
        <div className="screen-home-inner">
          <p className="label screen-home-kicker">{hero.role}</p>
          <h3 className="screen-home-name">{hero.name}</h3>

          <nav aria-label={nav.sections}>
            <ul className="screen-menu">
              {SCREEN_SECTIONS.map((section, index) => (
                <li key={section}>
                  <button type="button" onClick={() => open(section)} className="screen-menu-item">
                    <span className="tabular screen-menu-index" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="screen-menu-label">{label[section]}</span>
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
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    )
  }

  const pages: Pages =
    view === 'about'
      ? [
          {
            label: about.heading,
            body: (
              <>
                <p className="label screen-page-kicker">{about.kicker}</p>
                <p className="screen-statement">{about.lede}</p>
              </>
            ),
          },
          {
            label: about.capabilitiesLabel,
            body: (
              <ul className="screen-capabilities">
                {about.capabilities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ),
          },
        ]
      : view === 'process'
        ? [
            {
              label: process.heading,
              body: <p className="screen-statement">{process.intro}</p>,
            },
            ...process.steps.map((step) => ({
              label: step.label,
              body: <p className="screen-step-body">{step.body}</p>,
            })),
          ]
        : view === 'contact'
          ? [
              {
                label: contact.heading,
                body: (
                  <div className="screen-form">
                    <p className="screen-page-kicker label">{contact.intro}</p>
                    <ContactForm dict={contact} locale={locale} />
                  </div>
                ),
              },
            ]
          : []

  return (
    <div className="screen-ui">
      {view === 'work' ? (
        <ProjectPanes dict={work} active={active} />
      ) : (
        <Paged pages={pages} page={page} onPage={setPage} nav={nav} />
      )}

      <div className="screen-chrome">
        <span className="screen-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="screen-url">
          {view === 'work' ? projectFor(active).host : label[view as ScreenSection]}
        </span>
        <button type="button" onClick={() => open('home')} className="screen-back">
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
          <span>{work.back}</span>
        </button>

        {view === 'work' ? (
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
        ) : null}
      </div>
    </div>
  )
}

function projectFor(id: ProjectId) {
  return PROJECTS.find((project) => project.id === id) ?? PROJECTS[0]!
}

/**
 * One section, as a fixed run of screens.
 *
 * The live region is on the screen body rather than the counter: a screen
 * reader should hear the step it has arrived at, not the number of the step it
 * has arrived at. `polite` because the visitor caused the change and does not
 * need interrupting about it.
 *
 * Left and right arrows work here for the same reason they work in any pager,
 * and are bound on the container rather than the document so they cannot fight
 * the Escape handler that leaves the machine entirely.
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

  // Focus follows the page so a keyboard visitor is reading where the eye is.
  // The body is programmatically focusable only; it never enters the tab order.
  useEffect(() => {
    body.current?.focus({ preventScroll: true })
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

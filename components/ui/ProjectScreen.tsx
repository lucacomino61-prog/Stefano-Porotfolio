'use client'

import { PROJECTS, type Project, type ProjectId } from '@/lib/projects'
import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * The work, as the machine shows it.
 *
 * This used to own the whole screen: the home view, the chrome bar and the
 * switcher as well as the panes. Those moved to ScreenOS when the monitor
 * became the whole site rather than a project viewer, and what is left here is
 * the one thing that was always specific to a project: the preview.
 *
 * Everything below is measured in container query units, so the composition is
 * identical at every size the monitor passes through on the way in and does not
 * reflow as it grows. It is simply further away or closer.
 *
 * That is also why nothing here is an iframe. Both sites set frame-ancestors,
 * and a preview that depends on another origin's permission to render is a
 * preview that will one day be a blank rectangle in the middle of the work
 * section. This is built from the real hero image, the real headline, the real
 * navigation and the real palette, read off each site.
 */
export function ProjectPanes({
  dict,
  active,
}: {
  dict: Dictionary['work']
  active: ProjectId
}) {
  return (
    <>
      {PROJECTS.map((project) => (
        <Pane key={project.id} project={project} dict={dict} shown={project.id === active} />
      ))}
    </>
  )
}

function Pane({
  project,
  dict,
  shown,
}: {
  project: Project
  dict: Dictionary['work']
  shown: boolean
}) {
  const copy = dict.projects[project.id]

  return (
    <div
      className="screen-pane"
      data-shown={shown}
      // Inert rather than unmounted: the image stays decoded, so switching back
      // is instant instead of a flash of empty screen mid-zoom. inert also takes
      // the hidden pane's link and headings out of the tab order and out of the
      // accessibility tree, which opacity alone would not.
      inert={!shown}
      style={
        {
          '--screen-ground': project.screen.ground,
          '--screen-raised': project.screen.raised,
          '--screen-ink': project.screen.ink,
          '--screen-muted': project.screen.muted,
          '--screen-accent': project.screen.accent,
        } as React.CSSProperties
      }
    >
      {/* The site, as the site sets itself: its ground, its serif, its picture. */}
      <div className="screen-site">
        <div className="screen-site-nav">
          <span className="screen-site-word">{project.name}</span>
          <span className="screen-site-links">
            {project.nav.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </span>
        </div>

        <div className="screen-site-body">
          <div className="screen-site-copy">
            <h3 className="screen-site-headline">{project.headline}</h3>
            <p className="screen-site-standfirst">{project.standfirst}</p>
            <span className="screen-site-cta">{project.nav[0]}</span>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element -- The preview is
              sized in container query units against a screen whose own size is
              driven by the walk, so there is no layout width for next/image to
              generate a srcset against. The two files are already the size they
              are served at and are the only raster assets on the page. */}
          <img
            src={project.image.src}
            width={project.image.width}
            height={project.image.height}
            alt={copy.alt}
            loading="lazy"
            decoding="async"
            className="screen-site-image"
          />
        </div>
      </div>

      {/* The portfolio's own overlay on top of the preview: whose site this is,
          what it is, and the way out to the real thing. */}
      <div className="screen-plate">
        <div className="screen-plate-head">
          <span className="screen-index" aria-hidden="true">
            {project.index}
          </span>
          <span className="screen-name">{project.name}</span>
          <span className="screen-category">{copy.category}</span>
        </div>

        <p className="screen-description">{copy.description}</p>

        {/* What the thing actually is, in lines short enough to read off a
            monitor. Read from the running sites rather than written up: a
            portfolio that describes work it cannot point at is a brochure. */}
        <ul className="screen-facts">
          {copy.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
          <li>{project.year}</li>
        </ul>

        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="screen-cta"
          tabIndex={shown ? undefined : -1}
        >
          <span>
            {dict.live} {project.host.toUpperCase()}
          </span>
          <svg viewBox="0 0 16 16" aria-hidden="true" className="screen-cta-arrow">
            <path
              d="M4 12L12 4M12 4H6M12 4v6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>
    </div>
  )
}

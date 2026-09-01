import Image from 'next/image'

import type { Dictionary } from '@/lib/i18n/dictionaries'
import { PROJECTS } from '@/lib/projects'

/**
 * The work at length, after the monitor has introduced it.
 *
 * Two projects, two compositions. The first runs image-led and full width; the
 * second turns and sets the picture against the column. That is not variety for
 * its own sake — a repeated card is a claim that two pieces of work are the same
 * kind of thing, and a perfume house and a bar on a beach are not. The oversized
 * numerals are the only ornament, and they earn it by being the section's
 * navigation: there are two, and you can see which one you are in.
 *
 * These are the page's only raster images, so they are the only place next/image
 * is worth having: known dimensions, a real layout width to generate a srcset
 * against, AVIF and WebP from the config, and lazy below the fold.
 */
export function Work({ dict, label }: { dict: Dictionary['work']; label: string }) {
  return (
    <section id="work" aria-label={label} className="work">
      <div className="atmos work-atmos" aria-hidden="true" />

      <header className="work-head">
        <p className="label">{dict.kicker}</p>
        <h2 className="display work-heading">{dict.heading}</h2>
        <p className="lede work-intro">{dict.intro}</p>
      </header>

      {PROJECTS.map((project, index) => {
        const copy = dict.projects[project.id]
        const mirrored = index % 2 === 1

        return (
          <article
            key={project.id}
            className="work-item"
            data-mirrored={mirrored}
            style={{ '--project-glow': project.glow } as React.CSSProperties}
          >
            <span className="work-index" aria-hidden="true">
              {project.index}
            </span>

            <div className="work-figure">
              <Image
                src={project.image.src}
                width={project.image.width}
                height={project.image.height}
                alt={copy.alt}
                sizes="(max-width: 1023px) 92vw, 58vw"
                className="work-image"
              />
            </div>

            <div className="work-copy">
              <h3 className="display work-name">{project.name}</h3>

              <dl className="work-meta">
                <div>
                  <dt className="label">{dict.categoryLabel}</dt>
                  <dd>{copy.category}</dd>
                </div>
                <div>
                  <dt className="label">{dict.yearLabel}</dt>
                  <dd className="tabular">{project.year}</dd>
                </div>
              </dl>

              <p className="work-description">{copy.description}</p>

              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="work-link"
              >
                <span>
                  {dict.live} {project.host.toUpperCase()}
                </span>
                <svg viewBox="0 0 16 16" aria-hidden="true" className="work-link-arrow">
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
          </article>
        )
      })}
    </section>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Hero } from '@/components/sections/Hero'
import { GateMount } from '@/components/three/GateMount'
import { ProjectScreen } from '@/components/ui/ProjectScreen'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { setCinemaLive, setCinemaProgress } from '@/lib/motion/cinema'
import { MEDIA, ScrollTrigger, gsap } from '@/lib/motion/gsap'
import { PROJECTS, type ProjectId } from '@/lib/projects'

/**
 * The first screen and the walk to the monitor, as one continuous shot.
 *
 * They are one section because they are one camera move. Cutting between a hero
 * and a separate workstation section would mean two WebGL surfaces, two
 * establishing shots, and a join the visitor can feel. Here the room is behind
 * the name from the first frame, and scrolling simply walks into it.
 *
 * The handover at the end is the point of the whole sequence. Up close, the
 * panel is a texture: fine for a monitor across a room, useless for a control.
 * A link painted into WebGL cannot be focused, cannot be middle-clicked, cannot
 * be read by a screen reader and cannot be translated. So as the camera arrives,
 * a real DOM interface fades in over the panel it is already showing — same
 * composition, same palette, same words — and from that point on everything the
 * visitor can press is ordinary HTML. The physical monitor becomes the
 * interface rather than cutting to it.
 *
 * Three branches, per the project's motion contract. Narrow and reduced-motion
 * never pin: the interface is simply present, at rest, with the projects in it.
 */
export function Cinema({
  dict,
  hero,
  calendar,
}: {
  dict: Dictionary['work']
  hero: Dictionary['hero']
  calendar: Dictionary['calendar']
}) {
  const root = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<ProjectId>(PROJECTS[0]!.id)

  const select = useCallback((id: ProjectId) => setActive(id), [])

  useEffect(() => {
    const el = root.current
    if (!el) return

    const ctx = gsap.context(() => {
      const media = gsap.matchMedia()

      media.add(MEDIA.motion, () => {
        setCinemaLive(true)

        const timeline = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: '+=460%',
            scrub: 0.65,
            pin: stage.current,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            // The camera is not a tween. It is read off this value inside the
            // frame loop, so the scene never re-renders to move.
            onUpdate: (self) => setCinemaProgress(self.progress),
            onRefresh: (self) => setCinemaProgress(self.progress),
          },
        })

        // The copy clears the frame early, while there is still a room to look
        // at. Holding it any longer would leave a name floating over a monitor.
        timeline.to('[data-hero-copy]', { opacity: 0, yPercent: -4, duration: 0.16 }, 0.05)

        // The interface arrives only once the panel is nearly the frame, so the
        // crossfade lands on a picture the texture is already showing.
        timeline.fromTo(
          '[data-screen-ui]',
          { opacity: 0, scale: 0.965 },
          { opacity: 1, scale: 1, duration: 0.16, ease: 'power2.out' },
          0.8,
        )

        return () => {
          setCinemaLive(false)
          setCinemaProgress(0)
        }
      })

      // Still branches: nothing pins, nothing scrubs, and the interface is
      // simply on the page. Not a degradation — every project, the switcher and
      // both links are present and reachable.
      media.add(MEDIA.compact, () => setCinemaLive(false))
      media.add(MEDIA.reduced, () => setCinemaLive(false))

      return () => media.revert()
    }, el)

    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('load', refresh)

    return () => {
      window.removeEventListener('load', refresh)
      ctx.revert()
    }
  }, [])

  const project = PROJECTS.find((entry) => entry.id === active) ?? PROJECTS[0]!

  return (
    <section
      id="hero"
      ref={root}
      className="cinema"
      style={{ '--project-glow': project.glow } as React.CSSProperties}
    >
      <div ref={stage} className="cinema-stage">
        {/* The room's own light, thrown onto the page around the canvas so the
            frame does not end at the canvas edge. */}
        <div className="cinema-atmos atmos" aria-hidden="true" />

        <GateMount project={project} />

        <div data-hero-copy className="cinema-copy">
          <Hero dict={hero} calendar={calendar} />
        </div>

        <div data-screen-ui className="cinema-screen">
          <ProjectScreen dict={dict} active={active} onSelect={select} />
        </div>
      </div>
    </section>
  )
}

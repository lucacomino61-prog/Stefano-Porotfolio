'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { Hero } from '@/components/sections/Hero'
import { GateMount } from '@/components/three/GateMount'
import { DeskIndex } from '@/components/ui/DeskIndex'
import { ProjectScreen, type ScreenView } from '@/components/ui/ProjectScreen'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { setCinemaLive, setCinemaProgress } from '@/lib/motion/cinema'
import { MEDIA, ScrollTrigger, gsap } from '@/lib/motion/gsap'
import { deskFocusSnapshot } from '@/lib/motion/desk'
import { getScroller, scrollToTarget } from '@/lib/motion/scroller'
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
/**
 * Whether the walk exists at this width and preference.
 *
 * Needed in render, not just in the effect, because it decides whether the
 * screen interface is the page's real interface or a picture waiting behind a
 * zoom. Read through useSyncExternalStore so the answer follows a resize or a
 * preference change instead of being decided once at mount.
 */
function subscribeMotionMedia(onChange: () => void): () => void {
  const query = window.matchMedia(MEDIA.motion)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function readMotionMedia(): boolean {
  return window.matchMedia(MEDIA.motion).matches
}

/** The server has no viewport and no preference, so it never has a walk. */
function readMotionMediaOnServer(): boolean {
  return false
}

export function Cinema({
  dict,
  hero,
  calendar,
  deskIndex,
}: {
  dict: Dictionary['work']
  hero: Dictionary['hero']
  calendar: Dictionary['calendar']
  deskIndex: Dictionary['deskIndex']
}) {
  const root = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const exitControl = useRef<HTMLButtonElement>(null)
  /** Whatever pressed the way in, so the way out can hand focus back to it. */
  const opener = useRef<HTMLElement | null>(null)
  const [active, setActive] = useState<ProjectId>(PROJECTS[0]!.id)
  const [view, setView] = useState<ScreenView>('home')
  const [zoomed, setZoomed] = useState(false)
  const hasWalk = useSyncExternalStore(
    subscribeMotionMedia,
    readMotionMedia,
    readMotionMediaOnServer,
  )
  /**
   * The walk, as a timeline you press rather than a distance you scroll.
   *
   * Paused and reversible. Playing it walks in, reversing it walks out, and
   * because it is one timeline both directions use the same easing and the same
   * order of events. A second tween for the way back would drift out of step
   * with this one the first time either was retimed.
   */
  const walk = useRef<gsap.core.Timeline | null>(null)

  const select = useCallback((id: ProjectId) => setActive(id), [])

  /**
   * Walking up to the desk.
   *
   * This used to be a scroll distance: a pinned stage 460% tall, scrubbed. It
   * is now a press. The machine is the subject of this page rather than a thing
   * you pass on the way down it, and a subject you have to scroll past to
   * operate is not a subject. One timeline owns the move, so a click in the
   * room and the Escape key can never disagree about where you are standing.
   */
  const enter = useCallback(() => {
    const timeline = walk.current
    if (!timeline) {
      // Narrow and reduced-motion have no walk to take. The same control still
      // has to go somewhere, so it goes to the interface where it sits in the
      // page.
      scrollToTarget('[data-screen-ui]')
      return
    }
    /**
     * Align the stage to the viewport BEFORE locking, or the lock is a trap.
     *
     * Nothing pins any more, so the visitor is not necessarily standing at the
     * top of the stage when they press. Everything the zoom draws is anchored
     * to the stage and clipped by its `overflow: hidden`: the Back control sits
     * at `top: var(--gutter)`, which is 56px at most. Freeze the page a few
     * hundred pixels down and Back is above the viewport, unreachable in
     * principle, while the wheel is dead and the header's own links call
     * preventDefault and then a scrollTo that Lenis refuses while stopped.
     * Escape would be the only way out of a room with no visible exit.
     *
     * The jump is immediate rather than animated because the walk itself starts
     * on the next frame; an eased scroll would still be travelling while the
     * camera moved.
     */
    const scroller = getScroller()
    if (scroller) scroller.scrollTo(0, { immediate: true, force: true })
    else window.scrollTo({ top: 0, behavior: 'auto' })

    // Held while you are inside the machine. Without this the room could be
    // scrolled out from under the camera while the camera is busy looking at
    // it, which reads as the site breaking rather than as scrolling.
    scroller?.stop()
    // Remembered before the copy goes inert, because going inert is what blurs
    // whatever pressed the control in the first place.
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setZoomed(true)
    timeline.play()
  }, [])

  /**
   * Walking back out.
   *
   * State first, timeline second, and never conditional on the timeline. An
   * earlier revision returned early when there was no walk to reverse, which
   * made this a no-op in the one case that needed it most: cross the breakpoint
   * while zoomed and the matchMedia cleanup nulls the timeline, leaving `zoomed`
   * true, a Back control still painted over the name, and both it and Escape
   * refusing to do anything for the rest of the session.
   *
   * Restarting the scroller unconditionally is safe because this component is
   * the only thing on the site that ever stops it.
   */
  const exit = useCallback(() => {
    setZoomed(false)
    getScroller()?.start()
    walk.current?.reverse()
  }, [])

  /**
   * Focus follows the camera.
   *
   * Making the copy inert is what makes the room safe, and it is also what
   * drops focus: the browser blurs anything inside an element that becomes
   * inert, which would leave a keyboard visitor on `<body>` and send their next
   * Tab back to the skip link. So focus moves to the way out, which is the one
   * control the visitor needs and the only one drawn over the interface.
   *
   * Coming back it is handed to whatever pressed the way in, but only if the
   * browser has genuinely lost it. Exiting with Escape from somewhere else on
   * the page must not yank the page back to the hero.
   */
  useEffect(() => {
    if (zoomed) {
      exitControl.current?.focus()
      return
    }
    const previous = opener.current
    opener.current = null
    if (previous?.isConnected && document.activeElement === document.body) previous.focus()
  }, [zoomed])

  useEffect(() => {
    const el = root.current
    if (!el) return

    const ctx = gsap.context(() => {
      const media = gsap.matchMedia()

      media.add(MEDIA.motion, () => {
        setCinemaLive(true)

        // Nothing pins and nothing scrubs. The stage is an ordinary screenful
        // and the page below it scrolls normally; only the camera has stopped
        // being a function of the scrollbar.
        const position = { value: 0 }
        const timeline = gsap.timeline({ paused: true, defaults: { ease: 'none' } })

        // The camera is not a tween on the camera. It is read off this value
        // inside the frame loop, so the scene never re-renders to move.
        timeline.to(
          position,
          {
            value: 1,
            duration: 1.7,
            ease: 'power2.inOut',
            onUpdate: () => setCinemaProgress(position.value),
          },
          0,
        )

        // The copy clears the frame early, while there is still a room to look
        // at. Holding it any longer would leave a name floating over a monitor.
        timeline.to(
          '[data-hero-copy]',
          { opacity: 0, yPercent: -4, duration: 0.4, ease: 'power2.in' },
          0.05,
        )

        // The interface arrives only once the panel is nearly the frame, so the
        // crossfade lands on a picture the texture is already showing.
        timeline.fromTo(
          '[data-screen-ui]',
          { opacity: 0, scale: 0.965 },
          { opacity: 1, scale: 1, duration: 0.45, ease: 'power2.out' },
          1.2,
        )

        walk.current = timeline

        return () => {
          walk.current = null
          timeline.kill()
          setCinemaLive(false)
          setCinemaProgress(0)
          // The page is only ever held by this branch, so this branch is the
          // one that has to give it back. A revert across the breakpoint with
          // the scroller still stopped would leave the whole site frozen.
          getScroller()?.start()
          // And you cannot still be inside a machine this branch has just
          // taken away. Without this the Back control outlived the walk that
          // gave it meaning: still painted, over the name, doing nothing.
          setZoomed(false)
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

    /**
     * Escape walks back out.
     *
     * It defers to the desk: if a device is being looked at, that is the
     * innermost thing open and Escape belongs to it. WorkstationScene clears
     * the device on the same key, so this checks before acting rather than both
     * firing and the visitor losing two levels for one press.
     */
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (deskFocusSnapshot()) return
      exit()
    }
    window.addEventListener('keydown', handleKey)

    return () => {
      window.removeEventListener('load', refresh)
      window.removeEventListener('keydown', handleKey)
      ctx.revert()
    }
  }, [exit])

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

        {/* Room and copy are one block so the canvas can be scoped to the
            first screen. On desktop that block fills the pinned stage; on a
            phone nothing pins, and without this the canvas would stretch down
            behind the project panel underneath. */}
        <div className="cinema-room">
          <GateMount project={project} view={view} hint={dict.homeHint} onEnter={enter} />

          {/*
            Inert once the camera has left it, for the same reason the screen
            interface is inert before the camera arrives.

            The walk fades this block to opacity 0, and opacity 0 does not
            remove an element from the tab order or the accessibility tree.
            Measured from inside the machine: seven controls — both switches,
            "Open the workstation", "Send a message" and the three devices —
            still took focus while invisible, and a screen reader still read
            them. A mouse was only ever protected by the screen overlay
            happening to be painted on top; a keyboard had nothing.

            The exact mirror of `inert` on `.cinema-screen` below: one is live
            whenever the other is not.
          */}
          <div data-hero-copy className="cinema-copy" inert={hasWalk && zoomed}>
            <Hero dict={hero} calendar={calendar} enterLabel={dict.enter} onEnter={enter} />
            <DeskIndex dict={deskIndex} />
          </div>
        </div>

        {/* Escape is not discoverable on its own, and a visitor who has just
            been moved somewhere by a click needs the way back to be visible
            rather than remembered. */}
        {zoomed ? (
          <button ref={exitControl} type="button" onClick={exit} className="cinema-exit">
            {dict.back}
          </button>
        ) : null}

        {/*
          Inert until it is actually the interface.

          `.cinema-screen` is a full-stage overlay at opacity 0 while the room
          is being looked at, and opacity 0 does not remove an element from hit
          testing. Sitting at z-index 4 above the canvas and the hero copy, it
          was swallowing every click in the room: the click-to-enter, the hero's
          own controls, the desk buttons. It was live as well as invisible, with
          a focusable button in the accessibility tree that silently changed
          what the monitor was showing.

          `inert` fixes all of it at once: no pointer events, no tab stop, out
          of the accessibility tree. It is applied only where there is a walk to
          be behind, because on narrow and reduced-motion this element is the
          real interface and must stay live.
        */}
        <div data-screen-ui className="cinema-screen" inert={hasWalk && !zoomed}>
          <ProjectScreen
            dict={dict}
            active={active}
            onSelect={select}
            view={view}
            onView={setView}
            name={hero.name}
            role={hero.role}
          />
        </div>
      </div>
    </section>
  )
}

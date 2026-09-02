'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import { GateMount } from '@/components/three/GateMount'
import { ArcadeScreen } from '@/components/ui/ArcadeScreen'
import { AtmScreen } from '@/components/ui/AtmScreen'
import { ScreenOS } from '@/components/ui/ScreenOS'
import type { Machine, ScreenView } from '@/lib/screen'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { setCinemaLive, setCinemaProgress } from '@/lib/motion/cinema'
import { EMPTY_LOADING, loadingState, subscribeLoading } from '@/lib/motion/loading'
import { MEDIA, ScrollTrigger, gsap } from '@/lib/motion/gsap'
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
  const query = window.matchMedia(MEDIA.walk)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function readMotionMedia(): boolean {
  return window.matchMedia(MEDIA.walk).matches
}

/** The server has no viewport and no preference, so it never has a walk. */
function readMotionMediaOnServer(): boolean {
  return false
}

export function Cinema({
  dict,
  hero,
  nav,
  about,
  process,
  contact,
  arcade,
  atm,
  locale,
}: {
  dict: Dictionary['work']
  hero: Dictionary['hero']
  nav: Dictionary['nav']
  about: Dictionary['about']
  process: Dictionary['process']
  contact: Dictionary['contact']
  arcade: Dictionary['arcade']
  atm: Dictionary['atm']
  locale: Locale
}) {
  const root = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const exitControl = useRef<HTMLButtonElement>(null)
  /** Whatever pressed the way in, so the way out can hand focus back to it. */
  const opener = useRef<HTMLElement | null>(null)
  const [active, setActive] = useState<ProjectId>(PROJECTS[0]!.id)
  const [view, setView] = useState<ScreenView>('home')
  /** Which of the three screens the camera walks to: the monitor, the cabinet, or the cash machine. */
  const [machine, setMachine] = useState<Machine>('monitor')
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
  const enter = useCallback((next: Machine) => {
    setMachine(next)
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

  /**
   * The page stops being a page while you are inside the machine.
   *
   * `enter()` stops Lenis, and on a mouse that is enough. Lenis does not own
   * touch: it is constructed with `syncTouch: false` so a phone keeps native
   * scrolling, which means a finger scrolls the document straight past a
   * stopped scroller and drags the room out from under the camera. This is what
   * actually holds it, and it has to be on the element that scrolls rather than
   * on the stage.
   */
  useEffect(() => {
    if (!zoomed) return
    document.documentElement.dataset.machine = 'open'
    return () => {
      delete document.documentElement.dataset.machine
    }
  }, [zoomed])

  useEffect(() => {
    const el = root.current
    if (!el) return

    const ctx = gsap.context(() => {
      const media = gsap.matchMedia()

      media.add(MEDIA.walk, () => {
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
            // A slower, softer walk: the street is wide and the monitor is
            // small, so the approach covers far more ground than the old desk.
            duration: 2.6,
            ease: 'power3.inOut',
            onUpdate: () => setCinemaProgress(position.value),
          },
          0,
        )

        // The interface arrives only once the panel is nearly the frame, so the
        // crossfade lands on a picture the texture is already showing.
        // A tube coming on. The picture opens from a bright line, height first
        // and width a beat behind, which is the order a CRT's deflection
        // settles in; reversed, it is the same tube switching off. It lands on
        // a picture the texture is already showing, so the crossfade has
        // nothing to hide. The filter is cleared once it has landed so the
        // panel is not composited through an identity brightness for the rest
        // of the visit.
        timeline.fromTo(
          '[data-screen-ui]',
          { opacity: 0, scaleY: 0.02, scaleX: 1.08, filter: 'brightness(2.6)' },
          {
            opacity: 1,
            scaleY: 1,
            scaleX: 1,
            filter: 'brightness(1)',
            duration: 0.6,
            ease: 'expo.out',
            onComplete: () => gsap.set('[data-screen-ui]', { clearProps: 'filter' }),
          },
          2.0,
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

      // The one still branch. Reduced motion is the exact complement of the
      // walk query above, so between them every visitor is covered once and
      // only once. Not a degradation: the interface is simply on the page,
      // with every section, both links and the form present and reachable.
      media.add(MEDIA.reduced, () => setCinemaLive(false))

      return () => media.revert()
    }, el)

    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('load', refresh)

    /** Escape walks back out. */
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
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

  // One object for the life of the dictionary: the scene repaints the
  // billboard when this changes, and dressing the street is not cheap.
  const billboard = useMemo(
    () => ({ name: hero.name, role: hero.role, based: hero.based, hint: dict.enter }),
    [hero.name, hero.role, hero.based, dict.enter],
  )

  /**
   * Whether the room is drawing the interface, or the page has to.
   *
   * GateMount decides on mount whether a scene is coming — reduced motion turns
   * it down — and records that in the loading store. Reading it here rather
   * than re-deriving the media queries keeps one decision in one place: if the
   * room is coming, the panel is where the site lives; if it is not, the page
   * renders the same element itself. Before the decision lands it is undefined
   * and the flat copy is shown, so the site is complete without JavaScript and
   * without WebGL, and the room takes over only once it exists.
   */
  const scene = useSyncExternalStore(subscribeLoading, loadingState, () => EMPTY_LOADING)
  const roomMounted = scene.expecting === true

  const screenInterface = (
    <ScreenOS
      work={dict}
      about={about}
      process={process}
      contact={contact}
      nav={nav}
      hero={hero}
      arcade={arcade}
      locale={locale}
      active={active}
      onSelect={select}
      view={view}
      onView={setView}
    />
  )

  /**
   * What is drawn on the panel depends on which machine the camera walked to.
   *
   * Without a room there is only the page, and the page carries the site. The
   * games are still reachable there, as an application on the desktop; the
   * cash machine, which dispenses nothing the contact section does not already
   * say, stays in the street.
   *
   * The arcade and the cash machine take `active` rather than being unmounted
   * on exit: the walk out plays the tube switching off over half a second, and
   * a screen that went blank the instant Back was pressed would show the
   * attract texture through the picture that is still collapsing.
   */
  const machineInterface =
    !roomMounted || machine === 'monitor' ? (
      screenInterface
    ) : machine === 'arcade' ? (
      <ArcadeScreen dict={arcade} active={zoomed} />
    ) : (
      <AtmScreen dict={atm} hero={hero} about={about} steps={process} active={zoomed} />
    )

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
          <GateMount
            project={project}
            view={view}
            hint={dict.homeHint}
            billboard={billboard}
            machine={machine}
            onEnter={enter}
            onView={setView}
          />

          {/*
            The first screen is the street and nothing else. The name, the
            role and the way in are painted on the billboard on the bank's
            roof and on the screens in the lots, where they belong to the
            world rather than sitting over it.

            What stays in the DOM is what the world cannot carry: a real
            heading for the document, and a real control for the walk, drawn
            only while it has focus. A click target that exists only inside
            WebGL cannot be tabbed to, cannot be announced, and does not exist
            at all for anyone not using a pointer. Inert once the camera is
            inside a machine, the exact mirror of `inert` on `.cinema-screen`
            below: one is live whenever the other is not.
          */}
          <div className="cinema-copy" inert={hasWalk && zoomed}>
            <h1 className="sr-only">{hero.name}</h1>
            <p className="sr-only">{hero.role}</p>
            <button type="button" onClick={() => enter('monitor')} className="cinema-enter">
              {dict.enter}
            </button>
          </div>
        </div>

        {/*
          Escape is not discoverable on its own, and a visitor who has just been
          moved somewhere by a click needs the way back to be visible rather
          than remembered.

          Only from the menu, though. Inside a section the screen has its own
          "Back", which returns to the menu, and the two sat on top of each
          other in the same corner: two controls with the same word, one
          leaving the machine and one going up a level. One at a time, and the
          hierarchy reads: section, menu, room. Escape still leaves outright
          from anywhere, for anyone who wants the short way.
        */}
        {zoomed && (machine !== 'monitor' || view === 'home') ? (
          <button ref={exitControl} type="button" onClick={exit} className="cinema-exit">
            {dict.back}
          </button>
        ) : null}

        {/*
          The interface, and where it is drawn.

          When the room is drawing, this is pinned to the monitor's own
          rectangle — the panel's corners, projected through the live camera and
          published as custom properties every frame. The bezel, the chassis and
          the room stay around it while the site is being used. It used to be a
          full-viewport overlay, which meant the workstation vanished at exactly
          the moment the site became usable: the one thing this section exists
          to show.

          Without a room — reduced motion, no WebGL — the same element is laid
          into the page at a readable size instead, because the interface is the
          site and it cannot depend on a canvas.

          `inert` while the room is being looked at rather than used: opacity 0
          does not remove an element from hit testing, and this sits above the
          canvas.
        */}
        <div
          data-screen-ui
          className={roomMounted ? 'cinema-screen cinema-screen-panel' : 'cinema-screen cinema-screen-flat'}
          inert={hasWalk && !zoomed}
        >
          {machineInterface}
        </div>
      </div>
    </section>
  )
}

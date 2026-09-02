'use client'

import { ContactShadows, Environment, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, type RefObject } from 'react'
import {
  Box3,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  type MeshStandardMaterial,
  Object3D,
  type PerspectiveCamera,
  SRGBColorSpace,
  Vector3,
} from 'three'

import { cinema } from '@/lib/motion/cinema'
import {
  type DeskObjectId,
  desk,
  deskObject,
  registerDeskObject,
  resetDesk,
  setDeskFocused,
  setDeskHovered,
} from '@/lib/motion/desk'
import { loadingState, setSceneProgress } from '@/lib/motion/loading'
import { SCENE } from '@/lib/motion/sceneAssets'
import { damp, pointer, trackPointer } from '@/lib/motion/pointer'
import type { ScreenView } from '@/lib/screen'
import type { Project } from '@/lib/projects'

type Vec3 = [number, number, number]

type ModelProps = {
  url: string
  size: Vec3
  position?: Vec3
  rotation?: Vec3
  /**
   * Overrides the model's own material colour.
   *
   * These arrived from four different sources with four different ideas of what
   * a room looks like, and the desk in particular ships as pale bleached oak.
   * Dropped into a graded room it reads as a lit slab and takes the eye off the
   * one object the section is about. Retinting on load costs nothing and keeps
   * the scene a single lighting decision rather than four.
   */
  tint?: string
  roughness?: number
  metalness?: number
}

const MONITOR = SCENE.monitor.path
const PC_CASE = SCENE.tower.path
const MOUSE = SCENE.mouse.path
const KEYBOARD = SCENE.keyboard.path
const DESK = SCENE.desk.path
const STUDIO = SCENE.studio.path
const ROOM = SCENE.room.path

function prepareModel(source: Object3D): { model: Object3D; sourceSize: Vector3 } {
  const model = source.clone(true)
  const bounds = new Box3().setFromObject(model)
  const sourceSize = bounds.getSize(new Vector3())
  const center = bounds.getCenter(new Vector3())

  model.position.set(-center.x, -bounds.min.y, -center.z)
  model.traverse((child) => {
    if (!(child instanceof Mesh)) return
    child.castShadow = true
    child.receiveShadow = true
  })
  model.updateMatrixWorld(true)

  return { model, sourceSize }
}

/**
 * Every downloaded model arrived in a different unit system. This wrapper
 * normalises its origin to bottom-centre and then gives it an explicit real
 * world footprint, so the four devices actually sit on the same desk.
 */
function Model({
  url,
  size,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  tint,
  roughness,
  metalness,
}: ModelProps) {
  const { scene } = useGLTF(url)
  const prepared = useMemo(() => prepareModel(scene), [scene])

  useEffect(() => {
    if (tint === undefined && roughness === undefined && metalness === undefined) return
    prepared.model.traverse((child) => {
      if (!(child instanceof Mesh)) return
      const material = child.material as MeshStandardMaterial | MeshStandardMaterial[]
      const list = Array.isArray(material) ? material : [material]
      for (const entry of list) {
        if (!entry || !('color' in entry)) continue
        if (tint !== undefined) entry.color.set(tint)
        if (roughness !== undefined) entry.roughness = roughness
        if (metalness !== undefined) entry.metalness = metalness
      }
    })
  }, [prepared, tint, roughness, metalness])
  const scale = useMemo<Vec3>(
    () => [
      size[0] / Math.max(prepared.sourceSize.x, 0.0001),
      size[1] / Math.max(prepared.sourceSize.y, 0.0001),
      size[2] / Math.max(prepared.sourceSize.z, 0.0001),
    ],
    [prepared, size],
  )

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={prepared.model} />
    </group>
  )
}

/**
 * The panel.
 *
 * What is on it is the project itself: the site's own hero photograph, its own
 * headline, its own palette, drawn into a canvas texture at twice the panel's
 * pixel count so it holds up when the camera is close enough to touch it.
 *
 * The texture is the far view. Once the camera is near, a real DOM interface
 * fades in over the top of it — the switcher and the link out have to be
 * focusable, clickable, translatable and legible to a screen reader, and none
 * of those things are true of pixels painted into WebGL. The texture exists so
 * that the monitor across the room is showing something real rather than a
 * placeholder; the DOM exists so that the monitor you are standing at works.
 */
/** The panel's real size in the room, in metres. */
/**
 * How much room is left around the panel when the walk ends.
 *
 * 1 would put the panel's edges exactly on the frame edges. Above that, the
 * chassis and some of the desk stay in shot, which is what keeps the site
 * looking like something running on a machine rather than a page that has
 * replaced one.
 */
const PANEL_FRAMING = 1.34

const PANEL_W = 1.15
const PANEL_H = 0.64


/**
 * Where the camera stands before it walks in, relative to where the scroll
 * says it should be. Metres.
 *
 * Small on purpose, for two reasons. A dramatic swing from across the room
 * would fight the scroll walk that follows and would have to be sat through on
 * every reload; this reads as the last step of arriving rather than as a title
 * sequence.
 *
 * The second reason is a failure mode. The settle is animated in the frame
 * loop, so a starved loop leaves it at zero and the camera parked here for
 * good. That has to be a wider shot of the desk, not a shot of the ceiling: at
 * 2.4 back and 0.85 up the desk left the frame entirely. These values keep the
 * whole room composed even if the settle never runs at all.
 */
const ENTER_BACK = 1.1
const ENTER_LIFT = 0.32

/**
 * The drone shot at the wide end, in metres and hertz.
 *
 * Deliberately small. The desk has to stay composed in frame for as long as
 * nobody presses anything, so this is the amount of movement that reads as a
 * held camera rather than a shot going somewhere. The three rates are
 * mutually indivisible so the path does not visibly loop.
 */
const DRIFT_SWAY = 0.5
const DRIFT_RISE = 0.16
const DRIFT_PUSH = 0.22
const DRIFT_RATE_X = 0.17
const DRIFT_RATE_Y = 0.13
const DRIFT_RATE_Z = 0.11

/** What is outside the room: the background and the fog, which must be one value. */
/**
 * The room, in navy.
 *
 * It started near black, on the theory that a dark room makes a bright screen.
 * True, and it also meant there was nothing to look at but the screen. Navy is
 * the middle of that argument: dark enough that the panel is still the
 * brightest thing in frame, light enough to have a shape — the ambient is held
 * up so the walls, the reveal and the floor separate instead of merging into
 * one void. A colour needs light on it to read as a colour.
 */
const ROOM_VOID = '#0d1730'

const SCREEN_W = 2048
const SCREEN_H = 1152

/**
 * How hard the screen is driven.
 *
 * The panel is unlit on purpose: a screen makes its own light, so it takes a
 * meshBasicMaterial and no lamp in the room can touch it. The consequence is
 * that it shows the texture's literal colours, and the projects it shows are
 * dark sites: one of them grounds at #0b0a09, very nearly black, so a faithful
 * panel read as a switched-off monitor.
 *
 * A material colour above 1 multiplies the map in linear space, which lifts the
 * midtones without washing the blacks to grey the way adding a constant would.
 * The texture stays the project's real palette; only the backlight changes.
 */
const SCREEN_GAIN = 1.85
const SCREEN_DRIVE = new Color().setScalar(SCREEN_GAIN)

/**
 * The tube.
 *
 * Painted into the texture rather than run as a shader, for two reasons. The
 * texture is already a 2D canvas repainted only when the project or the view
 * changes, so this costs nothing per frame on the integrated GPU this has to
 * run on. And a raw ShaderMaterial would have taken the sRGB decode off three's
 * shoulders and onto mine, which is a colour-space bug waiting to happen for a
 * pair of dark lines.
 *
 * Scanlines belong to the screen, not to the viewer, so baking them at texture
 * resolution is also the physically honest place for them: they do not get
 * coarser as you walk up to it.
 *
 * Depth is deliberately low. These sit under type that has to stay readable at
 * both distances, and a CRT that costs a contrast ratio is a costume.
 */
const SCAN_PERIOD = 4
const SCAN_THICKNESS = 2
const SCAN_DEPTH = 0.055
const VIGNETTE_DEPTH = 0.34

function tube(context: CanvasRenderingContext2D): void {
  context.save()

  context.fillStyle = '#000'
  context.globalAlpha = SCAN_DEPTH
  for (let y = 0; y < SCREEN_H; y += SCAN_PERIOD) {
    context.fillRect(0, y, SCREEN_W, SCAN_THICKNESS)
  }

  // The glass falling away at the edges. Elliptical rather than round, because
  // the panel is wider than it is tall and a circular falloff would darken the
  // long sides while leaving the corners lit.
  context.globalAlpha = 1
  const vignette = context.createRadialGradient(
    SCREEN_W / 2,
    SCREEN_H / 2,
    SCREEN_H * 0.18,
    SCREEN_W / 2,
    SCREEN_H / 2,
    SCREEN_W * 0.72,
  )
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, `rgba(0,0,0,${VIGNETTE_DEPTH})`)
  context.fillStyle = vignette
  context.fillRect(0, 0, SCREEN_W, SCREEN_H)

  context.restore()
}

function MonitorScreen({
  project,
  panel,
  view,
  hint,
  onEnter,
}: {
  project: Project
  panel: RefObject<Mesh | null>
  view: ScreenView
  hint: string
  onEnter: () => void
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = SCREEN_W
    canvas.height = SCREEN_H
    const next = new CanvasTexture(canvas)
    next.colorSpace = SRGBColorSpace
    next.anisotropy = 8
    return next
  }, [])

  useEffect(() => {
    const canvas = texture.image as HTMLCanvasElement
    const context = canvas.getContext('2d')
    if (!context) return
    let cancelled = false

    const paint = (photo: HTMLImageElement | null) => {
      if (cancelled) return

      context.fillStyle = project.screen.ground
      context.fillRect(0, 0, SCREEN_W, SCREEN_H)

      // At rest the panel is not a poster of the work, it is a machine waiting
      // to be used. Painting the same invitation the DOM shows once you are
      // close means the screen says one thing from both distances.
      if (view === 'home') {
        context.fillStyle = project.screen.ink
        context.font = '600 96px system-ui, sans-serif'
        context.fillText('STEFANO DOKO', 110, SCREEN_H * 0.42)

        context.fillStyle = project.screen.muted
        context.font = '400 40px ui-monospace, monospace'
        context.fillText(hint.toUpperCase(), 112, SCREEN_H * 0.53)

        context.fillStyle = project.screen.accent
        context.fillRect(110, SCREEN_H * 0.63, 430, 88)
        context.fillStyle = project.screen.ground
        context.font = '600 34px ui-monospace, monospace'
        context.fillText('VIEW MY WORK', 150, SCREEN_H * 0.63 + 56)

        tube(context)
        // eslint-disable-next-line react-hooks/immutability
        texture.needsUpdate = true
        return
      }

      // The photograph fills the right half, bled off the edge and faded into
      // the ground rather than boxed, the way both sites set their own heroes.
      if (photo) {
        const boxX = SCREEN_W * 0.46
        const boxW = SCREEN_W - boxX
        const boxY = SCREEN_H * 0.12
        const boxH = SCREEN_H - boxY
        const cover = Math.max(boxW / photo.width, boxH / photo.height)
        const drawW = photo.width * cover
        const drawH = photo.height * cover
        context.save()
        context.beginPath()
        context.rect(boxX, boxY, boxW, boxH)
        context.clip()
        context.drawImage(
          photo,
          boxX + (boxW - drawW) / 2,
          boxY + (boxH - drawH) / 2,
          drawW,
          drawH,
        )
        const fade = context.createLinearGradient(boxX, 0, boxX + boxW * 0.42, 0)
        fade.addColorStop(0, project.screen.ground)
        fade.addColorStop(1, 'rgba(0,0,0,0)')
        context.fillStyle = fade
        context.fillRect(boxX, boxY, boxW, boxH)
        context.restore()
      }

      // The site's own chrome bar.
      context.fillStyle = project.screen.raised
      context.fillRect(0, 0, SCREEN_W, SCREEN_H * 0.075)
      context.fillStyle = project.screen.muted
      context.font = '500 30px ui-monospace, monospace'
      context.fillText(project.host, 96, SCREEN_H * 0.05)

      context.fillStyle = project.screen.accent
      context.font = '600 30px ui-monospace, monospace'
      context.fillText(project.index, SCREEN_W - 160, SCREEN_H * 0.05)

      // The headline, set the way the site sets it.
      context.fillStyle = project.screen.ink
      context.font = '400 104px Georgia, "Times New Roman", serif'
      wrap(context, project.headline, 96, SCREEN_H * 0.42, SCREEN_W * 0.4, 118)

      context.fillStyle = project.screen.muted
      context.font = '400 34px system-ui, sans-serif'
      wrap(context, project.standfirst, 96, SCREEN_H * 0.72, SCREEN_W * 0.36, 46)

      context.fillStyle = project.screen.accent
      context.fillRect(96, SCREEN_H * 0.83, 300, 8)

      tube(context)

      // The canvas is GPU memory, not React state: the texture object must stay
      // the same object while its pixels are re-uploaded. This is an upload, not
      // a mutation of anything React is tracking.
      texture.needsUpdate = true
    }

    paint(null)

    const photo = new Image()
    photo.crossOrigin = 'anonymous'
    photo.src = project.image.src
    photo.decode().then(
      () => paint(photo),
      () => {},
    )

    return () => {
      cancelled = true
    }
  }, [project, texture, view, hint])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh
      ref={panel}
      position={[0, 0.7, -0.273]}
      rotation={[0, Math.PI, 0]}
      onClick={(event) => {
        event.stopPropagation()
        onEnter()
      }}
      // The custom cursor reads this attribute, so the ring opens over the
      // panel exactly as it does over a link. Without it the one genuinely
      // clickable object in the room gives no sign that it is clickable.
      onPointerOver={(event) => {
        event.stopPropagation()
        document.documentElement.dataset.hot = 'true'
      }}
      onPointerOut={() => {
        delete document.documentElement.dataset.hot
      }}
    >
      <planeGeometry args={[PANEL_W, PANEL_H]} />
      <meshBasicMaterial map={texture} toneMapped={false} color={SCREEN_DRIVE} />
    </mesh>
  )
}

/** Canvas has no line breaking of its own. */
function wrap(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(' ')
  let line = ''
  let cursor = y
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, cursor)
      line = word
      cursor += lineHeight
    } else {
      line = candidate
    }
  }
  if (line) context.fillText(line, x, cursor)
}

/**
 * The camera.
 *
 * Scroll is a distance, not a timeline: progress 0 stands where you can see the
 * whole desk, progress 1 stands close enough that the panel covers the frame,
 * and the position between them is interpolated with an ease that mimics
 * walking — even speed underfoot, an accelerating picture.
 *
 * The end distance is solved from the panel rather than typed in. The panel's
 * world position and world scale are read every frame, which is what makes this
 * survive the breakpoint offsets the rig applies, the pointer parallax still
 * decaying underneath, and any future change to where the desk sits. A hardcoded
 * z would be correct at exactly one viewport.
 */
/**
 * Where the panel is on screen, in CSS pixels, republished every frame.
 *
 * The site is drawn in ordinary DOM over the canvas rather than inside it, and
 * this is what tells it where the monitor currently is: the panel's four world
 * corners projected through the live camera into an axis-aligned box, written
 * to custom properties on the root so the CSS can follow the monitor without
 * React re-rendering sixty times a second.
 *
 * Axis-aligned rather than a full four-corner homography, on purpose. The walk
 * ends square on to the panel, which is the only point at which the interface
 * is meant to be read and operated, and the slight keystone earlier in the
 * approach falls inside the fade the overlay is already doing. A matrix3d would
 * be correct at every frame and legible at none of them.
 */
const PANEL_CORNERS = [
  [-0.5, -0.5],
  [0.5, -0.5],
  [0.5, 0.5],
  [-0.5, 0.5],
] as const

function PanelProjection({ panel }: { panel: RefObject<Mesh | null> }) {
  const { camera, size } = useThree()
  const corner = useMemo(() => new Vector3(), [])
  const last = useRef('')

  useFrame(() => {
    const mesh = panel.current
    if (!mesh) return

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const [x, y] of PANEL_CORNERS) {
      corner.set(x * PANEL_W, y * PANEL_H, 0)
      mesh.localToWorld(corner)
      corner.project(camera)
      const px = ((corner.x + 1) / 2) * size.width
      const py = ((1 - corner.y) / 2) * size.height
      minX = Math.min(minX, px)
      maxX = Math.max(maxX, px)
      minY = Math.min(minY, py)
      maxY = Math.max(maxY, py)
    }

    const box = [minX, minY, maxX - minX, maxY - minY].map(Math.round)
    const next = box.join(',')
    if (next === last.current) return
    last.current = next

    const root = document.documentElement.style
    root.setProperty('--panel-x', `${box[0]}px`)
    root.setProperty('--panel-y', `${box[1]}px`)
    root.setProperty('--panel-w', `${box[2]}px`)
    root.setProperty('--panel-h', `${box[3]}px`)
  })

  return null
}


function CameraRig({ panel }: { panel: RefObject<Mesh | null> }) {
  const { camera, size } = useThree()
  const home = useRef<Vector3 | null>(null)
  const focus = useMemo(() => new Vector3(), [])
  const scale = useMemo(() => new Vector3(), [])
  const panelGoal = useMemo(() => new Vector3(), [])
  const scrollPos = useMemo(() => new Vector3(), [])

  /**
   * Looking at one device.
   *
   * A press does not take the camera away from the scroll, it leans it. The
   * scroll position is still solved every frame exactly as before, and the
   * object framing is a second position blended over the top by a damped
   * weight. Let go and the weight decays to zero, which lands the camera back
   * on whatever the scrollbar says without a return animation that could
   * disagree with a wheel turned meanwhile.
   *
   * The last framing is deliberately kept after the focus clears, because it is
   * the far end of that decay. Zeroing it would blend toward the origin of the
   * room and swing the camera through the desk on the way out.
   */
  const blend = useRef(0)
  /**
   * Walking in.
   *
   * The first beat of the entrance: the camera holds a step back and a little
   * above while the room is still loading, then settles onto the scroll
   * position once the scene reports it can actually draw. Held at 0 until then,
   * so the settle begins the moment the loading screen clears rather than
   * playing out behind it and being over before anyone sees it.
   *
   * It is an offset on the scroll position, not a second absolute camera. That
   * matters: wherever the scrollbar says to stand, the entrance still ends
   * exactly there, and a visitor who scrolls during the settle is not fighting
   * an animation that thinks it owns the viewport. It composes rather than
   * competes, the same way the object focus below does.
   */
  const arrival = useRef(0)
  /** Seconds of drone drift accumulated at the wide shot. */
  const drift = useRef(0)
  const enterPos = useMemo(() => new Vector3(), [])
  const objectPos = useMemo(() => new Vector3(), [])
  const objectLook = useMemo(() => new Vector3(), [])
  const lookNow = useMemo(() => new Vector3(), [])
  const bounds = useMemo(() => new Box3(), [])
  const extent = useMemo(() => new Vector3(), [])

  useFrame((_, delta) => {
    const mesh = panel.current
    if (!mesh) return
    if (!home.current) home.current = camera.position.clone()
    const step = Math.min(delta, 1 / 20) * 1000

    const { progress, live } = cinema()

    // Accumulated once, used by both paths. See DRIFT_* above.
    drift.current += Math.min(delta, 1 / 20)
    const driftT = drift.current
    const sway = Math.sin(driftT * DRIFT_RATE_X)
    const rise = Math.sin(driftT * DRIFT_RATE_Y + 1.1)
    const push = Math.cos(driftT * DRIFT_RATE_Z)

    if (!live) {
      /**
       * The drone shot.
       *
       * Standing still, the wide shot is a photograph of a room, and a
       * photograph does not read as a place you can walk into. A slow drift
       * says the camera is present before anything has been pressed, which is
       * the whole invitation on a phone, where there is no hover to discover
       * with and the desk is the only thing on screen.
       *
       * Three periods that do not divide into each other (0.17, 0.13, 0.11 Hz),
       * so the path never visibly repeats and never returns to the same frame
       * on a loop the eye can learn. Amplitudes are small and in metres: this
       * is a held shot breathing, not an orbit.
       *
       * Time is accumulated here rather than read off the clock. With
       * frameloop="never" the scene is advanced from gsap.ticker, and the delta
       * is already clamped above for exactly the frame-starvation case this
       * would otherwise turn into a lurch.
       */
      camera.position.set(
        home.current.x + sway * DRIFT_SWAY,
        home.current.y + rise * DRIFT_RISE,
        home.current.z + push * DRIFT_PUSH,
      )
      // The look target drifts a fraction of the camera, so the desk stays
      // composed instead of sliding across the frame with the move.
      camera.lookAt(sway * 0.06, 0.35 + rise * 0.03, 0)
      camera.updateProjectionMatrix()
      return
    }

    const perspective = camera as PerspectiveCamera
    const tangent = Math.tan(((perspective.fov ?? 44) * Math.PI) / 360)
    const aspect = size.width / Math.max(size.height, 1)

    mesh.getWorldPosition(focus)
    mesh.getWorldScale(scale)
    const halfHeight = (PANEL_H * scale.y) / 2
    const halfWidth = (PANEL_W * scale.x) / 2

    /*
     * Distance at which the panel *fits* the frame, not one at which it covers
     * it.
     *
     * Cover was the old rule: walk in until the screen overflows the viewport
     * on both axes and the bezel is outside it. That turned arrival into a
     * full-screen takeover — the monitor, the chassis and the room all gone at
     * the moment the site became usable, which is the one thing this section
     * exists to show. Fit stops with the whole panel in frame, and the margin
     * leaves the chassis and a little of the desk around it, so what you are
     * reading is visibly on a monitor standing in a room.
     */
    const fit = Math.max(halfHeight / tangent, halfWidth / (tangent * aspect))
    const near = fit * PANEL_FRAMING

    // Ease-in on the approach: the last strides change the picture far more
    // than the first ones, which is what walking toward something looks like.
    const eased = progress * progress * (3 - 2 * progress) * 0.35 + progress * progress * 0.65

    panelGoal.set(focus.x, focus.y, focus.z + near)
    scrollPos.lerpVectors(home.current, panelGoal, eased)

    // Armed by the room's own readiness signal, which arrives on the window
    // channel, so this works from the lazily imported copy of that module.
    if (loadingState().progress >= 1) {
      arrival.current = damp(arrival.current, 1, 1.5, step)
    }
    const entering = 1 - arrival.current
    /**
     * The drone is a wide-shot flourish, exactly like the pointer parallax on
     * the rig above. Held on at close range it would swing the panel out of
     * frame at the moment the panel has become the interface, so it fades on
     * the same curve as the approach and is gone on arrival.
     */
    const held = 1 - eased
    enterPos.set(
      scrollPos.x + sway * DRIFT_SWAY * held,
      scrollPos.y + rise * DRIFT_RISE * held + ENTER_LIFT * entering,
      scrollPos.z + push * DRIFT_PUSH * held + ENTER_BACK * entering,
    )

    const focused = desk().focused
    const target = focused ? deskObject(focused) : undefined

    if (target) {
      // Solved from the object's real world bounds rather than typed per
      // device, so moving something on the desk or swapping a model for a
      // better one cannot leave a hardcoded camera pointing at empty air.
      bounds.setFromObject(target)
      bounds.getCenter(objectLook)
      bounds.getSize(extent)
      const radius = Math.max(extent.x, extent.y, extent.z) / 2
      const distance = (radius / Math.max(tangent, 0.0001)) * 2.2
      objectPos.set(objectLook.x, objectLook.y + radius * 0.45, objectLook.z + distance)
    }

    blend.current = damp(blend.current, target ? 1 : 0, 5, step)

    camera.position.lerpVectors(enterPos, objectPos, blend.current)
    lookNow.copy(focus).lerp(objectLook, blend.current)
    camera.lookAt(lookNow)
  })

  return null
}

/**
 * A device on the desk you can look at.
 *
 * Wraps Model in a group that does three things Model has no business knowing
 * about: it registers itself so the camera can frame it, it raises a few
 * millimetres under the pointer, and it takes the press.
 *
 * The lift is a transform on the wrapper, added to whatever position Model
 * already has, so an object can be moved on the desk without touching this and
 * the hover cannot drift the layout. It is damped in the frame loop rather than
 * tweened on the event, because the pointer can cross three objects faster than
 * any tween would finish and the last one would win the argument.
 */
function DeskObject({
  id,
  enabled,
  ...model
}: ModelProps & { id: DeskObjectId; enabled: boolean }) {
  const outer = useRef<Group>(null)
  const lift = useRef(0)

  useEffect(() => {
    registerDeskObject(id, enabled ? outer.current : null)
    return () => registerDeskObject(id, null)
  }, [id, enabled])

  useFrame((_, delta) => {
    const group = outer.current
    if (!group) return
    const step = Math.min(delta, 1 / 20) * 1000
    const { hovered, focused } = desk()
    const raised = enabled && (hovered === id || focused === id)
    lift.current = damp(lift.current, raised ? 0.05 : 0, 9, step)
    group.position.y = lift.current
  })

  const handlers = enabled
    ? {
        onPointerOver: (event: { stopPropagation: () => void }) => {
          event.stopPropagation()
          setDeskHovered(id)
          // The same flag the panel sets, read by the custom cursor, so the
          // ring opens over a device exactly as it does over a link.
          document.documentElement.dataset.hot = 'true'
        },
        onPointerOut: (event: { stopPropagation: () => void }) => {
          event.stopPropagation()
          if (desk().hovered === id) setDeskHovered(null)
          delete document.documentElement.dataset.hot
        },
        onClick: (event: { stopPropagation: () => void }) => {
          event.stopPropagation()
          // Pressing the object you are already looking at puts it back.
          setDeskFocused(desk().focused === id ? null : id)
        },
      }
    : {}

  return (
    <group ref={outer} {...handlers}>
      <Model {...model} />
    </group>
  )
}

function Workstation({
  project,
  panel,
  view,
  hint,
  onEnter,
}: {
  project: Project
  panel: RefObject<Mesh | null>
  view: ScreenView
  hint: string
  onEnter: () => void
}) {
  const rig = useRef<Group>(null)
  const rotation = useRef({ x: 0, y: 0 })
  const { size } = useThree()

  useEffect(() => {
    const stop = trackPointer()

    // Escape is the way out of anything on this site, and a camera parked on a
    // keyboard with no way back except finding the object again is a trap.
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && desk().focused) setDeskFocused(null)
    }
    window.addEventListener('keydown', handleKey)

    return () => {
      stop()
      window.removeEventListener('keydown', handleKey)
      // The room can unmount mid-hover — a resize across the breakpoint, a
      // route change — and a stranded flag would leave the cursor open over
      // nothing for the rest of the session. The registry goes with it: a
      // focus held across a remount would point the camera at an object from
      // the previous scene.
      delete document.documentElement.dataset.hot
      resetDesk()
    }
  }, [])

  useFrame((_, delta) => {
    if (!rig.current) return
    const step = Math.min(delta, 1 / 20) * 1000
    const currentPointer = pointer()
    // The parallax is a wide-shot flourish. Held on at close range it would
    // swing the panel out of frame every time the pointer moved, so it is
    // faded out over the first third of the walk and gone by the time the
    // screen is the only thing in view.
    const hold = 1 - Math.min(1, cinema().progress / 0.34)
    rotation.current.y = damp(rotation.current.y, currentPointer.active ? currentPointer.nx * 0.08 * hold : 0, 3, step)
    rotation.current.x = damp(rotation.current.x, currentPointer.active ? currentPointer.ny * 0.025 * hold : 0, 3, step)
    rig.current.rotation.y = rotation.current.y
    rig.current.rotation.x = rotation.current.x
  })

  const compact = size.width < 760
  const medium = size.width < 1180
  const sceneScale = compact ? 0.72 : medium ? 0.88 : 1
  const sceneX = compact ? 0.6 : medium ? 0.9 : 1.35

  /**
   * Inspectable at every size now.
   *
   * This used to be desktop only, and the reason was sound at the time: below
   * the breakpoint nothing pinned, the room was a small picture at the top of a
   * scrolling page, and moving the camera to a mouse would have taken over a
   * viewport the visitor was in the middle of scrolling.
   *
   * None of that is true any more. The walk exists at every width, so on a
   * phone the room is a full screenful you have pressed your way into rather
   * than something you are scrolling past, and the page underneath is held
   * still while you are in it. The premise expired; the exclusion should go
   * with it, or a phone keeps three objects that are visibly there and do
   * nothing.
   */
  const interactive = true

  return (
    // Set into the corner, at an angle to the room. Square to the camera it
    // read as a product shot with a wall behind it; a desk pushed into the
    // angle of two walls is how a desk sits in a room, and it gives the wide
    // shot a diagonal to read along instead of a flat elevation.
    <group
      ref={rig}
      position={[sceneX, compact ? -0.12 : -0.03, -1.35]}
      rotation={[0, -0.46, 0]}
      scale={sceneScale}
    >
      <Model
        url={DESK}
        size={[3.25, 0.96, 1.48]}
        position={[-0.2, -1.18, 0.12]}
        tint="#8b8378"
        roughness={0.78}
        metalness={0.04}
      />

      <group position={[-0.34, -0.22, -0.03]} rotation={[0, Math.PI, 0]}>
        <Model url={MONITOR} size={[1.48, 1.12, 0.52]} />
        <MonitorScreen project={project} panel={panel} view={view} hint={hint} onEnter={onEnter} />

      </group>

      <DeskObject
        id="tower"
        enabled={interactive}
        url={PC_CASE}
        size={[0.82, 1.15, 0.72]}
        position={[1.08, -0.22, -0.04]}
        rotation={[0, Math.PI, 0]}
      />
      <DeskObject
        id="keyboard"
        enabled={interactive}
        url={KEYBOARD}
        size={[1.28, 0.13, 0.48]}
        position={[-0.34, -0.2, 0.68]}
        rotation={[0, Math.PI, 0]}
      />
      <DeskObject
        id="mouse"
        enabled={interactive}
        url={MOUSE}
        size={[0.19, 0.075, 0.29]}
        position={[0.55, -0.2, 0.72]}
        rotation={[0, Math.PI, 0]}
      />

      {/* What makes it a desk somebody uses rather than a product shot: a
          clock showing the real time, and something alive next to it. */}
      <DeskClock />
      <Cactus position={[-1.3, -0.2, 0.46]} scale={0.9} />
      <Cactus position={[1.24, -0.2, 0.2]} scale={0.62} />
    </group>
  )
}

/**
 * The room itself is a way in.
 *
 * The floor and the walls are real geometry, so a click on them never reaches
 * the Canvas's onPointerMissed. Without this, "click anywhere" would mean
 * "click the sky", and clicking the floor two inches from the desk would do
 * nothing at all.
 */
/**
 * The shell has nothing to cast onto anything: it IS the thing being cast
 * onto. Turning casting off for it drops every wall out of the shadow pass,
 * which is a full scene re-render into a square target, and the desk objects
 * that actually need to cast still do.
 */
/**
 * A little digital clock on the desk, showing the real time.
 *
 * Redrawn once a minute rather than once a second: at this size the seconds are
 * two pixels of noise, and a texture upload every second for something nobody
 * can read is a cost with no picture attached. The site already keeps a clock
 * to the second in the apparatus row, where it can actually be read.
 */
function DeskClock() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const next = new CanvasTexture(canvas)
    next.colorSpace = SRGBColorSpace
    return next
  }, [])

  useEffect(() => {
    const canvas = texture.image as HTMLCanvasElement
    const context = canvas.getContext('2d')
    if (!context) return

    const paint = () => {
      const now = new Date()
      context.fillStyle = '#07110f'
      context.fillRect(0, 0, 256, 128)
      context.fillStyle = '#6ff2c8'
      context.font = '600 76px ui-monospace, monospace'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        128,
        68,
      )
      // eslint-disable-next-line react-hooks/immutability
      texture.needsUpdate = true
    }

    paint()
    const id = setInterval(paint, 60_000)
    return () => clearInterval(id)
  }, [texture])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <group position={[-1.06, -0.16, 0.62]} rotation={[0, 0.5, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.19, 0.1, 0.06]} />
        <meshStandardMaterial color="#22262c" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.004, 0.031]}>
        <planeGeometry args={[0.15, 0.07]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  )
}

/**
 * A cactus, built from primitives rather than downloaded.
 *
 * Three capsules and a pot: at the size this reads on screen a modelled plant
 * would be a megabyte spent on silhouette, and silhouette is all a cactus is.
 */
function Cactus({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow receiveShadow position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.075, 0.058, 0.1, 16]} />
        <meshStandardMaterial color="#b0705a" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, 0.185, 0]}>
        <capsuleGeometry args={[0.042, 0.15, 4, 12]} />
        <meshStandardMaterial color="#4e8b5f" roughness={0.78} />
      </mesh>
      <mesh castShadow position={[0.062, 0.2, 0]} rotation={[0, 0, -0.6]}>
        <capsuleGeometry args={[0.024, 0.07, 4, 10]} />
        <meshStandardMaterial color="#4e8b5f" roughness={0.78} />
      </mesh>
      <mesh castShadow position={[-0.058, 0.235, 0.01]} rotation={[0, 0, 0.7]}>
        <capsuleGeometry args={[0.021, 0.055, 4, 10]} />
        <meshStandardMaterial color="#57986a" roughness={0.78} />
      </mesh>
    </group>
  )
}

function RoomModel() {
  const { scene } = useGLTF(ROOM)
  const room = useMemo(() => {
    const clone = scene.clone(true)

    clone.traverse((child) => {
      if (!(child instanceof Mesh)) return

      // Nothing here casts or receives at runtime. The shadows are already in
      // the texture: Cycles traced them once, offline, with bounce light the
      // real-time renderer cannot afford. Asking the shadow map to draw them a
      // second time would cost a full scene pass to produce a worse version of
      // an image the mesh is already wearing.
      child.castShadow = false
      child.receiveShadow = false

      const source = child.material as MeshStandardMaterial | MeshStandardMaterial[]
      const first = Array.isArray(source) ? source[0] : source
      const baked = first?.emissiveMap ?? first?.map ?? null
      if (!baked) return

      // Unlit, deliberately. The light is in the pixels; a lit material would
      // multiply it by whatever the lamps happen to be doing and the room would
      // drift every time the lighting changed for the objects standing in it.
      const flat = new MeshBasicMaterial({ map: baked, toneMapped: false })
      child.material = flat
    })

    return clone
  }, [scene])

  return <primitive object={room} />
}

function RoomShell({ accent, onEnter }: { accent: string; onEnter: () => void }) {
  return (
    <group
      onClick={(event) => {
        event.stopPropagation()
        if (desk().focused) {
          setDeskFocused(null)
          return
        }
        onEnter()
      }}
    >
      {/*
        The shell, modelled rather than assembled from primitives.

        It replaces a floor plane and two wall boxes. One mesh, but four
        primitives, one per material, so it is one draw call more than the
        three it supersedes and not fewer — and it carries fourteen boxes of
        geometry that as primitives would have been fourteen. 168 triangles and
        15KB, against the 1.5MB the tower already costs.

        What it buys is what primitives could not carry without becoming a list
        of coordinates to keep in sync: skirting where the wall meets the
        floor, a window opening with real depth instead of a lit rectangle
        stuck on a flat wall, and a right-hand wall, which this room never had.
        That absence is what let you see out of it.

        Authored at these exact coordinates, so it is a drop-in for the
        geometry it replaces rather than a re-measure of the room. The source
        is scripts/room.py; the GLB is a build artefact of it.
      */}
      <RoomModel />

      {/* A large architectural window gives the room depth without adding a
          heavyweight architectural model to the hero bundle. */}
      {/*
        Daylight behind the opening, and nothing else.

        The glazing bars that used to sit here were primitives floating a
        centimetre proud of a flat pane, from before the shell was modelled.
        The shell now carries a real opening with depth and a reveal, so the
        bars had nothing to frame: they read as four dark lines broken across
        the wall, which is exactly what they looked like. One lit plane set back
        inside the opening is the whole window now.
      */}
      <mesh position={[-2.55, 1.38, -3.02]}>
        <planeGeometry args={[2.62, 2.82]} />
        <meshStandardMaterial color="#dbe6f2" emissive="#cfe0f2" emissiveIntensity={0.55} />
      </mesh>

      <mesh position={[2.8, 1.35, -3.02]}>
        <boxGeometry args={[2.4, 1.62, 0.08]} />
        <meshStandardMaterial color="#2c3a4d" roughness={0.82} />
      </mesh>
      <mesh position={[2.8, 1.35, -2.96]}>
        <boxGeometry args={[2.15, 0.025, 0.025]} />
        <meshBasicMaterial color={accent} />
      </mesh>
    </group>
  )
}

/**
 * Mounts only once the Suspense boundary around it has resolved, which is the
 * one moment the room is genuinely ready to draw.
 *
 * This is the authoritative signal, not a progress reading. drei's useProgress
 * watches three's DefaultLoadingManager, and R3F's useLoader does not register
 * with it — it reports a total of zero here and never fires, which left the
 * loading screen waiting for its deadline while the assets had been on disk for
 * eight seconds. A component that cannot mount until its siblings' resources
 * exist cannot be wrong about whether they exist.
 */
function SceneReady() {
  useEffect(() => setSceneProgress(1), [])
  return null
}

/** A complete room-lit workstation, still driven by the application's GSAP ticker. */
export function WorkstationScene({
  project,
  view,
  hint,
  onEnter,
}: {
  project: Project
  view: ScreenView
  hint: string
  onEnter: () => void
}) {
  const panel = useRef<Mesh>(null)
  /**
   * The same threshold the rig uses for its own scale and offset, read here so
   * the two costs that are decided at this level -- the shadow map and the
   * contact pass -- agree with it rather than guessing at a second breakpoint.
   */
  const { size } = useThree()
  const compact = size.width < 760

  return (
    <>
      <CameraRig panel={panel} />
      <PanelProjection panel={panel} />
      {/*
        The void behind the room, and the fog that fades into it.

        One constant for both, because they have to agree: fog works by mixing
        geometry toward a colour, so if the background is a different colour the
        far wall dissolves into a seam instead of into distance.

        This is also what is now behind the room. The gate used to be, and it
        was the whole reason the right-hand side was bright: the room has no
        wall on that side, so past the back wall's edge you saw straight
        through to a lit shader plane. The gate is gone, so what shows there is
        this, and it agrees with the fog by construction.
      */}
      <color attach="background" args={[ROOM_VOID]} />
      <fog attach="fog" args={[ROOM_VOID, 8.5, 17]} />
      <ambientLight intensity={1.05} />
      {/* Key light, low and cool, from the window side. Cut back hard from what
          a product shot would use: this is a room in the evening with a screen
          on in it, and the screen has to be the brightest thing in the frame. */}
      <directionalLight
        castShadow
        color="#c8d4e8"
        intensity={1.15}
        position={[-3.5, 5.5, 4]}
        /* Halved on a phone. A shadow map is a full scene re-render into a
           square target every frame, so 1024 to 512 is a quarter of that cost,
           at a softness nobody reads as wrong on a 390px screen. */
        shadow-mapSize-width={compact ? 512 : 1024}
        shadow-mapSize-height={compact ? 512 : 1024}
        shadow-camera-far={16}
      />
      {/* The panel's own light in the room, in the colour of whatever is on it.
          This is where each project reaches past the bezel: change the project
          and the desk, the wall and the shadows change with it. */}
      <pointLight
        color={project.glow}
        intensity={5.5}
        distance={4.2}
        decay={2}
        position={[0.6, 0.5, 0.75]}
      />
      <pointLight color={project.glow} intensity={2.2} distance={6} position={[0.6, 1.5, -1.2]} />

      <Suspense fallback={null}>
        <SceneReady />
        <Environment files={STUDIO} environmentIntensity={0.55} />
        <RoomShell accent={project.screen.accent} onEnter={onEnter} />
        <Workstation
          project={project}
          panel={panel}
          view={view}
          hint={hint}
          onEnter={onEnter}
        />
        {/*
          Rendered a fixed number of times, not forever.

          This is a second render of the scene into its own target, and by
          default drei repeats it every frame. Nothing under the desk moves:
          the objects are static, and a contact shadow does not depend on where
          the camera is standing, so every frame after the first was redrawing
          the same picture. It sits inside this Suspense boundary, so by the
          time it mounts the models it is shadowing are already loaded.

          Forty rather than one because the materials are retinted in an effect
          and the arrival damping is still settling on the first frames; one
          would bake whatever happened to be there at mount.
        */}
        <ContactShadows
          position={[0.65, -1.205, 0.1]}
          opacity={0.58}
          scale={5.4}
          blur={2.5}
          far={4}
          frames={40}
          resolution={compact ? 256 : 512}
          color="#050506"
        />
      </Suspense>
    </>
  )
}

useGLTF.preload(MONITOR)
useGLTF.preload(PC_CASE)
useGLTF.preload(MOUSE)
useGLTF.preload(KEYBOARD)
useGLTF.preload(DESK)
useGLTF.preload(ROOM)

'use client'

import { ContactShadows, Environment, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, type RefObject } from 'react'
import {
  Box3,
  CanvasTexture,
  Group,
  Mesh,
  type MeshStandardMaterial,
  Object3D,
  type PerspectiveCamera,
  SRGBColorSpace,
  Vector3,
} from 'three'

import { cinema } from '@/lib/motion/cinema'
import { setSceneProgress } from '@/lib/motion/loading'
import { SCENE_ASSETS } from '@/lib/motion/sceneAssets'
import { damp, pointer, trackPointer } from '@/lib/motion/pointer'
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

const [MONITOR, PC_CASE, MOUSE, KEYBOARD, DESK, STUDIO] = SCENE_ASSETS

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
const PANEL_W = 1.15
const PANEL_H = 0.64

const SCREEN_W = 2048
const SCREEN_H = 1152

function MonitorScreen({
  project,
  panel,
}: {
  project: Project
  panel: RefObject<Mesh | null>
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

      // The canvas is GPU memory, not React state: the texture object must stay
      // the same object while its pixels are re-uploaded. This is an upload, not
      // a mutation of anything React is tracking.
      // eslint-disable-next-line react-hooks/immutability
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
  }, [project, texture])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh ref={panel} position={[0, 0.7, -0.273]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[PANEL_W, PANEL_H]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
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
function CameraRig({ panel }: { panel: RefObject<Mesh | null> }) {
  const { camera, size } = useThree()
  const home = useRef<Vector3 | null>(null)
  const focus = useMemo(() => new Vector3(), [])
  const goal = useMemo(() => new Vector3(), [])

  useFrame(() => {
    const mesh = panel.current
    if (!mesh) return
    if (!home.current) home.current = camera.position.clone()

    const { progress, live } = cinema()
    if (!live) {
      camera.position.copy(home.current)
      camera.lookAt(0, 0.35, 0)
      camera.updateProjectionMatrix()
      return
    }

    mesh.getWorldPosition(focus)
    const scale = mesh.getWorldScale(goal)
    const halfHeight = (PANEL_H * scale.y) / 2
    const halfWidth = (PANEL_W * scale.x) / 2

    // Distance at which the panel exactly covers the frame, on whichever axis
    // runs out first. A hair closer, so the last frame has no seam of bezel.
    const perspective = camera as PerspectiveCamera
    const tangent = Math.tan(((perspective.fov ?? 44) * Math.PI) / 360)
    const aspect = size.width / Math.max(size.height, 1)
    const near = Math.min(halfHeight / tangent, halfWidth / (tangent * aspect)) * 0.97

    // Ease-in on the approach: the last strides change the picture far more
    // than the first ones, which is what walking toward something looks like.
    const eased = progress * progress * (3 - 2 * progress) * 0.35 + progress * progress * 0.65

    goal.set(focus.x, focus.y, focus.z + near)
    camera.position.lerpVectors(home.current, goal, eased)
    camera.lookAt(focus.x, focus.y, focus.z)
  })

  return null
}

function Workstation({
  project,
  panel,
}: {
  project: Project
  panel: RefObject<Mesh | null>
}) {
  const rig = useRef<Group>(null)
  const rotation = useRef({ x: 0, y: 0 })
  const { size } = useThree()

  useEffect(() => trackPointer(), [])

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
  const sceneX = compact ? 0.12 : medium ? 0.45 : 0.95

  return (
    <group ref={rig} position={[sceneX, compact ? -0.12 : -0.03, 0]} scale={sceneScale}>
      <Model
        url={DESK}
        size={[3.25, 0.96, 1.48]}
        position={[-0.2, -1.18, 0.12]}
        tint="#2b2724"
        roughness={0.78}
        metalness={0.04}
      />

      <group position={[-0.34, -0.22, -0.03]} rotation={[0, Math.PI, 0]}>
        <Model url={MONITOR} size={[1.48, 1.12, 0.52]} />
        <MonitorScreen project={project} panel={panel} />
      </group>

      <Model
        url={PC_CASE}
        size={[0.82, 1.15, 0.72]}
        position={[1.08, -0.22, -0.04]}
        rotation={[0, Math.PI, 0]}
      />
      <Model
        url={KEYBOARD}
        size={[1.28, 0.13, 0.48]}
        position={[-0.34, -0.2, 0.68]}
        rotation={[0, Math.PI, 0]}
      />
      <Model
        url={MOUSE}
        size={[0.19, 0.075, 0.29]}
        position={[0.55, -0.2, 0.72]}
        rotation={[0, Math.PI, 0]}
      />
    </group>
  )
}

function RoomShell({ accent }: { accent: string }) {
  return (
    <group>
      <mesh position={[0, -1.22, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 12]} />
        <meshStandardMaterial color="#19191b" roughness={0.9} />
      </mesh>

      <mesh position={[0, 1.65, -3.15]} receiveShadow>
        <boxGeometry args={[11, 5.8, 0.12]} />
        <meshStandardMaterial color="#111113" roughness={0.96} />
      </mesh>

      <mesh position={[-5.3, 1.2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[8, 5, 0.12]} />
        <meshStandardMaterial color="#151517" roughness={0.94} />
      </mesh>

      {/* A large architectural window gives the room depth without adding a
          heavyweight architectural model to the hero bundle. */}
      {/* Evening outside, not a lightbox. The window is the room's only other
          source and it has to stay quieter than the panel, or the eye goes to
          the brightest rectangle and the section is about a window. */}
      <mesh position={[-2.55, 1.38, -3.04]}>
        <planeGeometry args={[2.7, 2.9]} />
        <meshStandardMaterial color="#2c3646" emissive="#3d5578" emissiveIntensity={0.22} />
      </mesh>
      {[-3.9, -2.55, -1.2].map((x) => (
        <mesh key={x} position={[x, 1.38, -2.96]}>
          <boxGeometry args={[0.045, 2.95, 0.045]} />
          <meshStandardMaterial color="#27272a" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[-2.55, 1.38, -2.95]}>
        <boxGeometry args={[2.75, 0.045, 0.045]} />
        <meshStandardMaterial color="#27272a" metalness={0.7} roughness={0.3} />
      </mesh>

      <mesh position={[2.8, 1.35, -3.02]}>
        <boxGeometry args={[2.4, 1.62, 0.08]} />
        <meshStandardMaterial color="#0b0b0c" roughness={0.82} />
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
export function WorkstationScene({ project }: { project: Project }) {
  const panel = useRef<Mesh>(null)

  return (
    <>
      <CameraRig panel={panel} />
      <fog attach="fog" args={['#07090b', 6.2, 13]} />
      <ambientLight intensity={0.3} />
      {/* Key light, low and cool, from the window side. Cut back hard from what
          a product shot would use: this is a room in the evening with a screen
          on in it, and the screen has to be the brightest thing in the frame. */}
      <directionalLight
        castShadow
        color="#c8d4e8"
        intensity={1.15}
        position={[-3.5, 5.5, 4]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
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
        <RoomShell accent={project.screen.accent} />
        <Workstation project={project} panel={panel} />
        <ContactShadows
          position={[0.65, -1.205, 0.1]}
          opacity={0.58}
          scale={5.4}
          blur={2.5}
          far={4}
          resolution={512}
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

import {
  CanvasTexture,
  Clock,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshMatcapMaterial,
  NoToneMapping,
  Object3D,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import { BLOOM_LAYER, createBloom } from './bloom'
import { CONTENT } from './content'
import { createInteraction, type Mode } from './interaction'
import { createHud } from './ui/hud'
import { createLoader } from './ui/loader'
import { createFloor } from './world/floor'
import { createHologram } from './world/hologram'
import { createScreens } from './world/screens'

/**
 * A ramen shop at night, after jesse-zhou.com.
 *
 * It was built and lit in Blender (blender/build_shop.py) and baked into four
 * atlases; nothing here is lit at runtime, every surface paints its atlas.
 * What stays live is what a bake cannot hold: the neon as flat colours on a
 * bloom layer, the screens as canvases, the fans, the hologram, the mirror
 * under everything, and the camera. Every mesh gets its role from its name,
 * and the manifest the bake wrote says which name is which.
 */
type Manifest = {
  groups: Record<string, { atlas: string; size: number }>
  glow: { palette: Record<string, { color: string; gain: number; bloom?: boolean }>; objects: Record<string, string> }
  live: Record<string, string[]>
}

const LIVE_TARGETS: Record<Mode, string[]> = {
  default: ['hit_projects', 'hit_about', 'hit_articles', 'hit_credits', 'hit_name', 'hit_arcade', 'hit_arcadeScreen', 'hit_vending', 'hit_vendScreen', 'hit_bigScreen', 'hit_articles_easel'],
  projects: ['hit_vend_prev', 'hit_vend_next', 'hit_vendScreen'],
  about: ['hit_small1', 'hit_small2', 'hit_small3', 'hit_bigScreen'],
  credits: ['hit_arcadeScreen', 'hit_arcade'],
  name: [],
}
const HINTS: Record<Mode, string> = {
  default: 'Drag to look around · Click a sign',
  projects: 'Click the buttons to browse · Click the poster to open it',
  about: 'Click a small screen · Esc to leave',
  credits: 'Click the screen to continue',
  name: 'Click anywhere to go back',
}

function matcapTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  const g = ctx.createRadialGradient(44, 40, 4, 64, 64, 64)
  g.addColorStop(0, '#f2f4ff')
  g.addColorStop(0.35, '#9aa6cc')
  g.addColorStop(0.8, '#3a4068')
  g.addColorStop(1, '#141628')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  return t
}

/** The words on the screens, once more as plain text for assistive technology. */
function fillReadable(): void {
  const name = document.getElementById('sr-name')
  const body = document.getElementById('sr-body')
  if (!name || !body) return
  name.textContent = CONTENT.name
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
  const projects = CONTENT.projects
    .map((p) => `<li>${p.url ? `<a href="${esc(p.url)}">${esc(p.title)}</a>` : esc(p.title)}: ${esc(p.blurb)}</li>`)
    .join('')
  const skills = CONTENT.about.skills.map((s) => `<li>${esc(s.group)}: ${esc(s.items.join(', '))}</li>`).join('')
  const experience = CONTENT.about.experience.map((e) => `<li>${esc(e.when)} — ${esc(e.what)}, ${esc(e.where)}</li>`).join('')
  const credits = CONTENT.credits.map((c) => `<li>${esc(c.title)}: ${esc(c.lines.join('. '))}</li>`).join('')
  const social = CONTENT.social.map((s) => `<li><a href="${esc(s.url)}">${esc(s.label)}</a></li>`).join('')
  body.innerHTML =
    `<p>${esc(CONTENT.roles.join(', '))}</p><h2>About</h2>${CONTENT.about.intro.map((p) => `<p>${esc(p)}</p>`).join('')}` +
    `<h3>Skills</h3><ul>${skills}</ul><h3>Experience</h3><ul>${experience}</ul><h2>Projects</h2><ul>${projects}</ul>` +
    `<h2>Articles</h2><p><a href="${esc(CONTENT.articlesUrl)}">Articles</a></p><h2>Credits</h2><ul>${credits}</ul><h2>Contact</h2><ul>${social}</ul>`
}

async function main() {
  fillReadable()
  const loader = createLoader()
  const compact = window.innerWidth < 760 || window.matchMedia('(pointer: coarse)').matches
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const params = new URLSearchParams(location.search)
  const lite = params.has('lite')

  const app = document.getElementById('app') as HTMLElement
  const renderer = new WebGLRenderer({ antialias: lite, powerPreference: 'high-performance' })
  renderer.setPixelRatio(lite ? 1 : Math.min(window.devicePixelRatio, compact ? 1.5 : 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.toneMapping = NoToneMapping
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setClearColor(0x000000, 1)
  app.appendChild(renderer.domElement)

  const scene = new Scene()
  scene.background = new Color(0x000000)
  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.4, 80)

  // ---- the shop: one GLB, four atlases, a manifest
  const manifest = (await fetch('/models/shop-manifest.json').then((r) => r.json())) as Manifest
  loader.step(0.04)
  const draco = new DRACOLoader()
  draco.setDecoderPath('/draco/')
  const gltfLoader = new GLTFLoader()
  gltfLoader.setDRACOLoader(draco)
  const textureLoader = new TextureLoader()
  const groups = Object.entries(manifest.groups)
  let arrived = 0
  const total = groups.length + 1
  const tick = () => {
    arrived++
    loader.step(0.05 + (arrived / total) * 0.9)
  }
  const atlasPath = (atlas: string) => `/textures/${compact ? atlas.replace(/\.(jpg|png)$/, '-half.$1') : atlas}`
  const [gltf, ...atlasTextures] = await Promise.all([
    gltfLoader.loadAsync('/models/shop.glb').then((g) => {
      tick()
      return g
    }),
    ...groups.map(([, { atlas }]) =>
      textureLoader.loadAsync(atlasPath(atlas)).then((texture) => {
        texture.flipY = false
        texture.colorSpace = SRGBColorSpace
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
        tick()
        return texture
      }),
    ),
  ])
  const atlases: Record<string, Texture> = {}
  groups.forEach(([name], i) => (atlases[name] = atlasTextures[i]))

  const shop = gltf.scene as Group
  const screens = createScreens()
  const hitboxes = new Map<string, Object3D>()
  const plates = new Map<string, { material: MeshBasicMaterial; base: Color }>()
  const fans: Object3D[] = []
  const emissiveOf = manifest.glow.objects
  const palette = manifest.glow.palette
  const matcap = new MeshMatcapMaterial({ matcap: matcapTexture() })
  const textMaterial = new MeshBasicMaterial({ color: '#f4f2ff' })
  let holoAt = new Vector3(-0.1, 2.05, -0.95)
  let floorBaked: Texture | null = null

  shop.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const name = object.name
    if (name === 'floor') {
      floorBaked = atlases.floor
      object.visible = false
      return
    }
    if (atlases[name]) {
      // the noren curtain is a single sheet inside the shop group, seen from both sides;
      // the bake lands a little dark for the reference's saturated look, so the atlases are lifted
      object.material = new MeshBasicMaterial({ map: atlases[name], color: new Color(1.25, 1.25, 1.25), toneMapped: false, ...(name === 'shopJoined' ? { side: DoubleSide } : {}) })
      return
    }
    const glowKey = emissiveOf[name]
    if (glowKey && palette[glowKey]) {
      const base = new Color(palette[glowKey].color).multiplyScalar(palette[glowKey].gain)
      const material = new MeshBasicMaterial({ color: base, toneMapped: false })
      object.material = material
      if (palette[glowKey].bloom !== false) object.layers.enable(BLOOM_LAYER)
      if (name.startsWith('plate_')) plates.set(name.slice(6), { material, base })
      return
    }
    const screenMaterial = screens.material(name)
    if (screenMaterial) {
      object.material = screenMaterial
      return
    }
    if (name.startsWith('hit_')) {
      object.material = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
      object.userData.skipBloom = true
      hitboxes.set(name, object)
      return
    }
    if (name === 'holoMarker') {
      holoAt = object.getWorldPosition(new Vector3())
      object.visible = false
      return
    }
    if (/^fan\d$/.test(name) || /^fanHub\d$/.test(name)) {
      object.material = matcap
      if (/^fan\d$/.test(name)) fans.push(object)
      return
    }
    if (name.startsWith('floor')) {
      object.material = textMaterial
      return
    }
    object.material = new MeshBasicMaterial({ color: '#5a5570' })
  })
  scene.add(shop)
  loader.step(0.97)

  // ---- what the bake could not hold
  const mirror = !compact && !lite
  const floor = createFloor(renderer, floorBaked ?? atlases.floor, mirror)
  scene.add(floor.mesh)
  const hologram = createHologram(holoAt, renderer.getPixelRatio())
  scene.add(hologram.points)
  const bloom = lite ? null : createBloom(renderer, scene, camera, compact ? 3 : 2, 0.8, !compact)

  const hud = createHud({ onGo: (mode) => go(mode), onBack: () => go('default') })
  const interaction = createInteraction(
    camera,
    renderer.domElement,
    hitboxes,
    { onHover: (name) => hover(name), onClick: (name) => click(name), onArrive: (mode) => arrive(mode) },
    { reducedMotion },
  )

  function hover(name: string | null): void {
    plates.forEach((p, id) => {
      const hot = name === `hit_${id}`
      p.material.color.copy(p.base).multiplyScalar(hot ? 1.6 : 1)
    })
    screens.setHover(name)
  }

  function go(mode: Mode): void {
    if (interaction.flying) return
    if (mode === interaction.mode && mode !== 'default') return
    interaction.setLive([])
    screens.setButtons(false)
    hud.setMode(mode)
    hud.setHint(mode === 'default' ? HINTS.default : '')
    interaction.flyTo(mode)
  }

  function arrive(mode: Mode): void {
    interaction.setLive(LIVE_TARGETS[mode])
    screens.setButtons(mode === 'about')
    if (mode === 'about') screens.setAboutPage('intro')
    hud.setMode(mode)
    hud.setHint(HINTS[mode])
  }

  function open(url: string | undefined): void {
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  function click(name: string | null): void {
    const mode = interaction.mode
    if (mode === 'default') {
      if (!name) return
      if (name === 'hit_projects' || name === 'hit_vending' || name === 'hit_vendScreen') go('projects')
      else if (name === 'hit_about' || name === 'hit_bigScreen') go('about')
      else if (name === 'hit_credits' || name === 'hit_arcade' || name === 'hit_arcadeScreen') go('credits')
      else if (name === 'hit_name') go('name')
      else if (name === 'hit_articles' || name === 'hit_articles_easel') open(CONTENT.articlesUrl)
      return
    }
    if (mode === 'projects') {
      if (name === 'hit_vend_prev') screens.setProject(screens.project - 1)
      else if (name === 'hit_vend_next') screens.setProject(screens.project + 1)
      else if (name === 'hit_vendScreen') open(CONTENT.projects[screens.project].url)
      else go('default')
      return
    }
    if (mode === 'about') {
      if (name === 'hit_small3') screens.setAboutPage('skills')
      else if (name === 'hit_small2') screens.setAboutPage('experience')
      else if (name === 'hit_bigScreen') screens.setAboutPage('intro')
      else go('default')
      return
    }
    if (mode === 'credits') {
      if (name === 'hit_arcadeScreen' || name === 'hit_arcade') screens.setCreditsPage(screens.creditsPage + 1)
      else go('default')
      return
    }
    go('default')
  }

  // one frame behind the door, so the first thing seen is the shop
  renderer.render(scene, camera)
  await loader.ready()
  hud.show()
  hud.setHint(HINTS.default)
  interaction.intro()

  const clock = new Clock()
  let time = 0
  const frame = () => {
    const dt = Math.min(clock.getDelta(), 0.25)
    time += dt
    for (const [i, fan] of fans.entries()) fan.rotateZ(dt * (i ? -7 : 9))
    hologram.update(time)
    screens.update(time)
    interaction.update(dt)
    if (bloom) bloom.render()
    else renderer.render(scene, camera)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    bloom?.resize(window.innerWidth, window.innerHeight)
    floor.resize(window.innerWidth, window.innerHeight)
  })

  if (import.meta.env.DEV) {
    ;(window as unknown as { __ramen: unknown }).__ramen = { scene, camera, renderer, interaction, screens, hitboxes, shop, bloom, go, manifest }
  }
}

main().catch((error: unknown) => {
  console.error(error)
  const note = document.getElementById('loader-note')
  if (note) {
    note.hidden = false
    note.textContent = 'The shop could not load. This needs a browser with WebGL.'
  }
})

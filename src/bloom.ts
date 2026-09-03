import { Layers, Mesh, MeshBasicMaterial, ShaderMaterial, Vector2, type Camera, type Material, type Object3D, type Scene, type WebGLRenderer } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

/**
 * Selective bloom, the way the reference's neon glows: the glowing things live
 * on a second layer, the scene is rendered once with everything else painted
 * black to make the bloom, then once normally, and the two are added.
 *
 * Anything with `userData.skipBloom` (the click targets, the mirror floor) is
 * hidden for the black pass rather than painted black, or it would occlude
 * the neon behind it.
 *
 * The mix pass takes a ShaderMaterial rather than a shader object on purpose:
 * handed an object, ShaderPass clones the uniforms and the bloom texture never
 * reaches the shader.
 */
export const BLOOM_LAYER = 1

export type Bloom = {
  render: () => void
  resize: (width: number, height: number) => void
  setStrength: (value: number) => void
}

export function createBloom(renderer: WebGLRenderer, scene: Scene, camera: Camera, divisor: number, strength = 1.3, smaa = false): Bloom {
  const layer = new Layers()
  layer.set(BLOOM_LAYER)
  const dark = new MeshBasicMaterial({ color: 'black' })
  const swapped = new Map<Object3D, Material | Material[]>()
  const hidden: Object3D[] = []

  const size = renderer.getSize(new Vector2())
  const bloomPass = new UnrealBloomPass(new Vector2(size.x / divisor, size.y / divisor), strength, 0.45, 0.0)
  const bloomComposer = new EffectComposer(renderer)
  bloomComposer.renderToScreen = false
  bloomComposer.addPass(new RenderPass(scene, camera))
  bloomComposer.addPass(bloomPass)

  const mix = new ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: bloomComposer.renderTarget2.texture },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D baseTexture;
      uniform sampler2D bloomTexture;
      varying vec2 vUv;
      void main() {
        vec4 col = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);
        float vignette = 1.0 - 0.35 * smoothstep(0.35, 1.2, length((vUv - 0.5) * vec2(1.5, 1.2)));
        gl_FragColor = vec4(col.rgb * vignette, col.a);
      }
    `,
  })
  const finalComposer = new EffectComposer(renderer)
  finalComposer.addPass(new RenderPass(scene, camera))
  finalComposer.addPass(new ShaderPass(mix, 'baseTexture'))
  finalComposer.addPass(new OutputPass())
  // the composer's targets are not multisampled, so the edges are smoothed after the fact
  const smaaPass = smaa ? new SMAAPass(size.x * renderer.getPixelRatio(), size.y * renderer.getPixelRatio()) : null
  if (smaaPass) finalComposer.addPass(smaaPass)

  return {
    render() {
      scene.traverse((object) => {
        if (object.userData.skipBloom) {
          if (object.visible) {
            object.visible = false
            hidden.push(object)
          }
          return
        }
        if (object instanceof Mesh && !layer.test(object.layers)) {
          swapped.set(object, object.material)
          object.material = dark
        }
      })
      bloomComposer.render()
      swapped.forEach((material, object) => {
        ;(object as Mesh).material = material
      })
      swapped.clear()
      for (const object of hidden) object.visible = true
      hidden.length = 0
      finalComposer.render()
    },
    resize(width, height) {
      bloomComposer.setSize(width, height)
      finalComposer.setSize(width, height)
      bloomPass.resolution.set(width / divisor, height / divisor)
      smaaPass?.setSize(width * renderer.getPixelRatio(), height * renderer.getPixelRatio())
    },
    setStrength(value) {
      bloomPass.strength = value
    },
  }
}

'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { ShaderMaterial, Vector2, Vector3 } from 'three'

import { damp, pointer, trackPointer } from '@/lib/motion/pointer'
import { getScroller } from '@/lib/motion/scroller'

import { gateFragmentShader, gateVertexShader } from './gateShader'

/** Reads an sRGB hex custom property into 0..1 floats. See the shader comment. */
function readColour(name: string, fallback: [number, number, number]): Vector3 {
  if (typeof window === 'undefined') return new Vector3(...fallback)
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const hex = raw.replace('#', '')
  if (hex.length !== 6) return new Vector3(...fallback)
  return new Vector3(
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  )
}

/** +1 on the night ground, -1 on the day one. See the shader. */
function readPolarity(): number {
  if (typeof document === 'undefined') return 1
  return document.documentElement.getAttribute('data-theme') === 'light' ? -1 : 1
}

/**
 * The material is constructed once, imperatively, and attached as a primitive.
 *
 * Declaring <shaderMaterial uniforms={...}> would mean either holding the
 * uniforms in a memo and mutating it every frame, which the compiler's
 * immutability rule correctly rejects, or reading a ref during render, which
 * its refs rule correctly rejects. Both rules are right: a per-frame mutable
 * uniform block is not React state. Owning the material outright sidesteps the
 * argument and makes disposal explicit rather than implicit.
 */
function createMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: gateVertexShader,
    fragmentShader: gateFragmentShader,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uShutter: { value: 0 },
      uProgress: { value: 0 },
      uResolution: { value: new Vector2(1, 1) },
      uPointer: { value: new Vector2(0, 0) },
      uGround: { value: readColour('--ground', [0.043, 0.043, 0.047]) },
      uMark: { value: readColour('--mark', [0.91, 0.827, 0.294]) },
      uPolarity: { value: readPolarity() },
    },
  })
}

export function HeroGate() {
  const { viewport, size } = useThree()
  const [material] = useState(createMaterial)
  const shutter = useRef(0)
  const heroHeight = useRef(0)
  // Starts raised: the material was built from whatever the stylesheet said at
  // construction, which on the first client render is before the boot script's
  // attribute has been read back.
  const themeDirty = useRef(true)
  const finePointer = useRef<MediaQueryList | null>(null)

  // The ground and the mark are read off the stylesheet, so when the sheet
  // turns over the material is holding last hour's colours. Watching the
  // attribute rather than taking a prop keeps the canvas out of the theme's
  // React tree entirely: CSS changes, the uniforms follow, nothing re-renders.
  //
  // The observer only raises a flag. The uniforms themselves are written in the
  // frame loop below, which is the one place in this file allowed to touch
  // them, and where the read of the computed style lands on a frame boundary
  // rather than in the middle of a mutation callback.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      themeDirty.current = true
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    finePointer.current = window.matchMedia('(hover: hover) and (pointer: fine)')
    // Shares the one pointer listener with the cursor rather than adding a
    // second. On a touch device this is a no-op and the parallax stays at zero.
    const stopTracking = trackPointer()
    return () => {
      stopTracking()
      finePointer.current = null
      material.dispose()
    }
  }, [material])

  /* eslint-disable react-hooks/immutability -- The uniform block is GPU
     memory, not React state. It must be the same object every frame, written
     in place sixty times a second, and it is never read during render or used
     to decide what to render: the only consumer is the shader program. Copying
     it to satisfy the rule would allocate on every frame and still have to be
     written through to the material. The material's lifetime is owned here and
     disposed in the effect above. */
  useFrame((_, delta) => {
    const u = material.uniforms
    // Clamped: a backgrounded tab hands back a delta of several seconds, which
    // would jump the grain and spike the smear on the frame it resumes.
    const step = Math.min(delta, 1 / 20)

    if (themeDirty.current) {
      u.uGround.value = readColour('--ground', [0.043, 0.043, 0.047])
      u.uMark.value = readColour('--mark', [0.91, 0.827, 0.294])
      u.uPolarity.value = readPolarity()
      themeDirty.current = false
    }

    u.uTime.value += step
    u.uResolution.value.set(size.width, size.height)

    const lenis = getScroller()
    const velocity = lenis ? Math.abs(lenis.velocity) : 0
    shutter.current = damp(shutter.current, Math.min(1, velocity / 2600), 9, step * 1000)
    u.uShutter.value = shutter.current

    // Pointer parallax, damped at lambda 3 so the light trails the pointer
    // rather than tracking it. pointer() is already normalised and clamped.
    //
    // The media query is read from a MediaQueryList held on a ref, not by
    // calling matchMedia here: that parses the query string and allocates a
    // new object on every rendered frame. When there is no fine pointer the
    // parallax eases back to centre rather than freezing wherever it stopped.
    const p = pointer()
    const fine = finePointer.current?.matches ?? false
    u.uPointer.value.set(
      damp(u.uPointer.value.x, fine ? p.nx : 0, 3, step * 1000),
      damp(u.uPointer.value.y, fine ? -p.ny : 0, 3, step * 1000),
    )

    // Lenis already holds the scroll position it just applied, so prefer it
    // over window.scrollY. Reading scrollY can force a style and layout flush
    // when the frame has pending transform writes, and by this point in the
    // frame the cursor and every ScrollTrigger have written theirs.
    if (heroHeight.current === 0) heroHeight.current = window.innerHeight
    const scrolled = lenis ? lenis.scroll : window.scrollY
    u.uProgress.value = Math.min(1, scrolled / heroHeight.current)
  })
  /* eslint-enable react-hooks/immutability */

  return (
    <mesh position={[0, 0, -4]} scale={[viewport.width * 2, viewport.height * 2, 1]}>
      <planeGeometry args={[1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

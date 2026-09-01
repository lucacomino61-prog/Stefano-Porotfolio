/**
 * Film grain over the whole viewport.
 *
 * Rendered live from a turbulence filter rather than tiled from a noise image.
 * A tiled bitmap shows its seams at exactly the scale this is used at, shows
 * them worst across the large flat areas it exists to break up, and resolves at
 * one pixel density — which on a retina display means either a soft tile or a
 * file four times the size. A filter has none of those problems and costs one
 * element.
 *
 * Server-rendered and static: no state, no effect, nothing to hydrate.
 */
export function Grain() {
  return (
    <svg className="grain" aria-hidden="true" focusable="false">
      <filter id="grain-filter">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.82"
          numOctaves={3}
          stitchTiles="stitch"
        />
        {/* Turbulence is colour noise; the site wants luminance noise. */}
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain-filter)" />
    </svg>
  )
}

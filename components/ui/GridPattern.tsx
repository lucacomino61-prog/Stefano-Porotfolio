import { useId } from 'react'

import { cn } from '@/lib/utils'

type GridPatternProps = {
  width?: number
  height?: number
  x?: number
  y?: number
  strokeDasharray?: string
  className?: string
}

/**
 * Adapted from Magic UI's Grid Pattern (magicui.design, via 21st.dev).
 *
 * Two changes from the original, both deliberate:
 *
 * 1. The default `fill-gray-400/30 stroke-gray-400/30` classes are removed.
 *    The craft floor for this project bans grey, every colour comes from a
 *    token, and leaving defaults in place would also have forced tailwind-merge
 *    into the dependency list just to override them. Callers pass the stroke.
 * 2. `[key: string]: unknown` and the prop spread are dropped. They let any
 *    attribute through onto the SVG, including ones that would override
 *    aria-hidden.
 * 3. The `squares` prop is dropped. Its rects carry no fill of their own and
 *    relied on the removed default fill class, so with (1) applied they would
 *    have painted the SVG initial value, pure black: invisible on this ground
 *    and a banned colour besides. Nothing here uses it, and an unused prop
 *    that renders wrongly the first time somebody reaches for it is worse than
 *    no prop.
 *
 * In this world the grid is a ground glass focusing screen: the ruled surface a
 * camera operator frames against, and the same ruling the report sheet uses.
 */
export function GridPattern({
  width = 40,
  height = 40,
  x = -1,
  y = -1,
  strokeDasharray = '0',
  className,
}: GridPatternProps) {
  // useId keeps the pattern id unique, so several grids on one page do not
  // collide and silently adopt each other's cell size.
  const id = useId()

  return (
    <svg aria-hidden="true" className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}>
      <defs>
        <pattern id={id} width={width} height={height} patternUnits="userSpaceOnUse" x={x} y={y}>
          <path d={`M.5 ${height}V.5H${width}`} fill="none" strokeDasharray={strokeDasharray} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
    </svg>
  )
}

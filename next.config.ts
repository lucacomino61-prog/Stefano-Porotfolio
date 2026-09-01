import path from 'node:path'

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Without this, Turbopack walks up looking for a lockfile, finds an unrelated
  // one in the home directory, and warns that it is ignoring it. Pinning the
  // root keeps resolution inside the project.
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  // The same stray lockfile also widens production file tracing, which would
  // walk the whole home directory looking for dependencies to bundle.
  outputFileTracingRoot: path.resolve(process.cwd()),
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
}

export default nextConfig

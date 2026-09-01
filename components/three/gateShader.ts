export const gateVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * An empty film gate.
 *
 * There is no footage in it yet, and that is the honest state of this site: the
 * projects have not been supplied. What the gate shows is the film itself,
 * running. When real project imagery arrives it is composited into this same
 * aperture rather than replacing it.
 *
 * uShutter is the shutter angle, driven by scroll velocity. Scroll fast and the
 * shutter opens, so the grain smears vertically the way a long exposure does on
 * a moving frame. Stop, and it resolves. This is the one uniform that carries
 * both requirements from the brief: a scroll-driven shader parameter, and a
 * velocity-aware effect. They are the same physical idea, so they are one
 * uniform rather than two unrelated effects.
 *
 * Colours arrive as sRGB floats and are written straight out. ShaderMaterial
 * does not get three's colorspace_fragment include, so nothing converts them,
 * and passing them through THREE.Color would linearise them and leave the
 * canvas a visibly different black from the CSS ground behind it.
 */
export const gateFragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uShutter;
  uniform float uProgress;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform vec3 uGround;
  uniform vec3 uMark;
  // +1 on the night ground, -1 on the day one. Exposure is added to the ground
  // there and subtracted from it here: a lamp in a dark room is a pool of
  // light, and the same lamp over a sheet of paper is a pool of shadow around
  // it. Adding to a ground already at 0.95 would only clip it to flat white.
  uniform float uPolarity;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec2 uv = vUv;

    // Gate weave. Film never sits perfectly still in the aperture, and the
    // amount here is under a thousandth of the frame: felt, not seen.
    uv.x += sin(uTime * 1.7) * 0.0009;
    uv.y += cos(uTime * 1.3) * 0.0006;

    // Grain, stretched vertically by the open shutter.
    float smear = 1.0 + uShutter * 26.0;
    vec2 grainPos = vec2(uv.x * uResolution.x, (uv.y * uResolution.y) / smear);
    // Stepped at 24fps rather than per frame, so it reads as film rather than
    // as television static, and costs the same.
    float grain = hash(floor(grainPos) + floor(uTime * 24.0));

    // Exposure falls away from the centre of the aperture, and that centre
    // follows the pointer a little. This is the hero's pointer parallax: the
    // light moves rather than the geometry, which costs nothing and cannot
    // shift a single pixel of layout. uPointer arrives already damped and
    // clamped to -1..1.
    vec2 centred = uv - 0.5 - uPointer * 0.045;
    centred.x *= uResolution.x / max(uResolution.y, 1.0);
    float vignette = smoothstep(0.95, 0.12, length(centred));

    // The aperture has to read as a pool of light, not as an absence. An
    // earlier pass topped out around rgb(29,29,29), which rendered as a void
    // and left the first viewport as a large name on black: exactly the
    // category default this direction exists to refuse.
    float falloff = 1.0 - uProgress * 0.7;
    float pool = mix(0.018, 0.165, vignette) * falloff;
    // On the night ground the pool is added: a lamp in a dark room. On the day
    // ground there is no headroom above paper white to add to — adding would
    // only clip the middle of the frame to flat white — so the same gradient is
    // subtracted from the edges instead and the centre is left at paper. Same
    // falloff, same centre, opposite direction: light pooled in a dark room,
    // shade gathering at the edge of a lit sheet.
    float exposure = uPolarity > 0.0 ? pool : pool - 0.165 * falloff;
    vec3 colour = uGround + exposure + (grain - 0.5) * (0.042 + uShutter * 0.06);

    // Halation where the light meets the edge of the aperture.
    float edge = smoothstep(0.26, 0.5, abs(centred.y));
    // Added on both sheets, not flipped with the rest. The mark is warm under
    // either light — canary on the night ground, marker ink on the day one —
    // and a small warm addition is halation in both directions.
    colour += uMark * edge * vignette * 0.035;

    gl_FragColor = vec4(colour, 1.0);
  }
`

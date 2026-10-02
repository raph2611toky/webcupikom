import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import "./CoreEffect.css";

const TAU = Math.PI * 2;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = (t) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function polar(cx, cy, radiusX, radiusY, angle, rotation = 0) {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const cr = Math.cos(rotation);
  const sr = Math.sin(rotation);
  const x = ca * radiusX;
  const y = sa * radiusY;
  return {
    x: cx + x * cr - y * sr,
    y: cy + x * sr + y * cr,
  };
}

function arcPoints(cx, cy, radius, flatten, a0, a1, rotation, count = 22) {
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    points.push(polar(cx, cy, radius, radius * flatten, lerp(a0, a1, t), rotation));
  }
  return points;
}

function strokePolyline(ctx, points, { width, stroke, alpha = 1, blur = 0, dash = null }) {
  if (!points.length) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (blur) {
    ctx.shadowColor = stroke;
    ctx.shadowBlur = blur;
  }
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.restore();
}

function drawRingSegment(ctx, config) {
  const {
    cx,
    cy,
    radius,
    flatten,
    a0,
    a1,
    rotation,
    thickness,
    alpha,
    glass,
    depthOffset = 0,
  } = config;

  const outer = arcPoints(cx, cy + depthOffset, radius, flatten, a0, a1, rotation, 28);
  const inner = arcPoints(
    cx,
    cy + depthOffset,
    Math.max(1, radius - thickness),
    flatten,
    a1,
    a0,
    rotation,
    28,
  );
  const shape = [...outer, ...inner];

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(shape[0].x, shape[0].y);
  for (let i = 1; i < shape.length; i += 1) ctx.lineTo(shape[i].x, shape[i].y);
  ctx.closePath();

  const grad = ctx.createLinearGradient(cx - radius, cy - radius * 0.5, cx + radius, cy + radius * 0.5);
  if (glass) {
    grad.addColorStop(0, "rgba(255,255,255,.12)");
    grad.addColorStop(0.22, "rgba(164,112,255,.18)");
    grad.addColorStop(0.55, "rgba(222,204,255,.52)");
    grad.addColorStop(0.82, "rgba(121,47,255,.28)");
    grad.addColorStop(1, "rgba(255,255,255,.10)");
  } else {
    grad.addColorStop(0, "#07070b");
    grad.addColorStop(0.28, "#16101f");
    grad.addColorStop(0.52, "#030305");
    grad.addColorStop(0.74, "#231335");
    grad.addColorStop(1, "#050507");
  }
  ctx.fillStyle = grad;
  ctx.shadowColor = glass ? "rgba(121,47,255,.78)" : "rgba(102,0,252,.42)";
  ctx.shadowBlur = glass ? 22 : 12;
  ctx.fill();

  ctx.lineWidth = glass ? 1.35 : 1.15;
  ctx.strokeStyle = glass ? "rgba(231,218,255,.9)" : "rgba(135,75,255,.8)";
  ctx.stroke();

  // Fine purple rim to fake an extruded bevel.
  const rim = arcPoints(cx, cy + depthOffset - thickness * 0.05, radius - thickness * 0.15, flatten, a0, a1, rotation, 26);
  strokePolyline(ctx, rim, {
    width: glass ? 1.3 : 1.05,
    stroke: glass ? "rgba(244,236,255,.92)" : "rgba(119,38,255,.88)",
    alpha: 0.85,
    blur: glass ? 10 : 7,
  });

  ctx.restore();
}

function drawFragment(ctx, fragment, x, y, scale, rotation, alpha) {
  const sides = fragment.sides;
  const r = fragment.size * scale;
  if (r < 0.2 || alpha <= 0) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;
  ctx.shadowColor = fragment.dark ? "rgba(82,17,210,.52)" : "rgba(128,54,255,.72)";
  ctx.shadowBlur = 12 * scale;

  const grad = ctx.createLinearGradient(-r, -r, r, r);
  if (fragment.dark) {
    grad.addColorStop(0, "rgba(15,12,22,.96)");
    grad.addColorStop(0.5, "rgba(2,2,4,.98)");
    grad.addColorStop(1, "rgba(66,26,102,.9)");
  } else {
    grad.addColorStop(0, "rgba(238,228,255,.82)");
    grad.addColorStop(0.55, "rgba(110,30,255,.35)");
    grad.addColorStop(1, "rgba(186,143,255,.72)");
  }

  ctx.fillStyle = grad;
  ctx.strokeStyle = fragment.dark ? "rgba(122,61,255,.72)" : "rgba(242,235,255,.88)";
  ctx.lineWidth = Math.max(0.8, 1.2 * scale);
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const ang = fragment.phase + (i / sides) * TAU;
    const mod = i % 2 === 0 ? 1 : fragment.irregular;
    const px = Math.cos(ang) * r * mod;
    const py = Math.sin(ang) * r * mod * 0.82;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawOrb(ctx, cx, cy, radius, alpha, pulse) {
  const r = radius * pulse;
  ctx.save();
  ctx.globalAlpha = alpha;

  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
  halo.addColorStop(0, "rgba(211,185,255,.58)");
  halo.addColorStop(0.22, "rgba(119,43,255,.38)");
  halo.addColorStop(0.58, "rgba(102,0,252,.13)");
  halo.addColorStop(1, "rgba(102,0,252,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.2, 0, TAU);
  ctx.fill();

  const sphere = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.31, r * 0.06, cx, cy, r);
  sphere.addColorStop(0, "rgba(255,255,255,.98)");
  sphere.addColorStop(0.12, "rgba(211,184,255,.95)");
  sphere.addColorStop(0.43, "rgba(102,0,252,.92)");
  sphere.addColorStop(0.74, "rgba(33,4,82,.96)");
  sphere.addColorStop(1, "rgba(3,2,8,.98)");
  ctx.fillStyle = sphere;
  ctx.shadowColor = "rgba(102,0,252,.88)";
  ctx.shadowBlur = r * 0.68;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1, r * 0.035);
  ctx.strokeStyle = "rgba(220,198,255,.88)";
  ctx.stroke();

  // Inner floating pearl.
  const innerR = r * 0.38;
  const inner = ctx.createRadialGradient(cx - innerR * 0.2, cy - innerR * 0.25, 0, cx, cy, innerR);
  inner.addColorStop(0, "#fff");
  inner.addColorStop(0.25, "#b67cff");
  inner.addColorStop(0.78, "#6d16f4");
  inner.addColorStop(1, "#22004f");
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, TAU);
  ctx.fill();

  ctx.restore();
}

function drawPlatform(ctx, cx, cy, radius, alpha, time, beamVisibility = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const y = cy + radius * 0.94;
  for (let i = 0; i < 3; i += 1) {
    const rr = radius * (0.52 + i * 0.16);
    ctx.beginPath();
    ctx.ellipse(cx, y + i * 3, rr, rr * 0.13, 0, 0, TAU);
    ctx.lineWidth = Math.max(1, radius * (i === 1 ? 0.025 : 0.012));
    ctx.strokeStyle = i === 1 ? "rgba(119,39,255,.82)" : "rgba(184,139,255,.58)";
    ctx.shadowColor = "rgba(102,0,252,.72)";
    ctx.shadowBlur = 14 + i * 6;
    ctx.stroke();
  }

  const glow = ctx.createRadialGradient(cx, y, 0, cx, y, radius * 0.85);
  glow.addColorStop(0, "rgba(142,78,255,.20)");
  glow.addColorStop(0.48, "rgba(102,0,252,.11)");
  glow.addColorStop(1, "rgba(102,0,252,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(cx, y, radius * 0.88, radius * 0.21, 0, 0, TAU);
  ctx.fill();

  ctx.globalAlpha = alpha * clamp(beamVisibility);
  const beamAlpha = 0.32 + Math.sin(time * 2.4) * 0.06;
  const beam = ctx.createLinearGradient(cx, y, cx, cy - radius * 0.3);
  beam.addColorStop(0, `rgba(151,81,255,${beamAlpha})`);
  beam.addColorStop(0.55, "rgba(139,63,255,.14)");
  beam.addColorStop(1, "rgba(139,63,255,0)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(cx - radius * 0.055, y);
  ctx.lineTo(cx - radius * 0.015, cy - radius * 0.38);
  ctx.lineTo(cx + radius * 0.015, cy - radius * 0.38);
  ctx.lineTo(cx + radius * 0.055, y);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

export default function CoreEffect() {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return undefined;

    const random = seededRandom(11427);
    const fragments = Array.from({ length: 24 }, (_, index) => {
      const angle = random() * TAU;
      return {
        angle,
        side: Math.cos(angle) >= 0 ? 1 : -1,
        outer: 1.15 + random() * 1.1,
        targetRing: index % 3,
        size: 8 + random() * 15,
        sides: 3 + Math.floor(random() * 4),
        phase: random() * TAU,
        spin: (random() * 2 - 1) * (0.8 + random() * 1.4),
        irregular: 0.57 + random() * 0.35,
        dark: random() > 0.6,
        delay: random() * 0.42,
        vertical: (random() * 2 - 1) * 0.48,
      };
    });

    const particles = Array.from({ length: 86 }, () => {
      const angle = random() * TAU;
      return {
        angle,
        side: Math.cos(angle) >= 0 ? 1 : -1,
        radius: 0.52 + random() * 1.2,
        speed: (0.08 + random() * 0.19) * (random() > 0.5 ? 1 : -1),
        phase: random() * TAU,
        size: 0.7 + random() * 1.7,
        lift: (random() * 2 - 1) * 0.24,
        alpha: 0.22 + random() * 0.6,
      };
    });

    const rings = [
      { radius: 0.76, thickness: 0.14, segments: 6, flatten: 0.76, speed: 0.10, offset: 0.18 },
      { radius: 0.56, thickness: 0.13, segments: 6, flatten: 0.80, speed: -0.135, offset: -0.38 },
      { radius: 0.96, thickness: 0.10, segments: 5, flatten: 0.70, speed: 0.073, offset: 0.58 },
    ];

    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let startedAt = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onPointerMove = (event) => {
      const x = event.clientX / Math.max(1, window.innerWidth) - 0.5;
      const y = event.clientY / Math.max(1, window.innerHeight) - 0.5;
      pointerRef.current.tx = x;
      pointerRef.current.ty = y;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    resize();

    const draw = (now) => {
      raf = window.requestAnimationFrame(draw);
      const rawTime = (now - startedAt) / 1000;
      const time = reduceMotion ? 5.2 : rawTime;

      const assemble = reduceMotion ? 1 : smooth((time - 0.14) / 1.95);
      const pulse = reduceMotion ? 1 : smooth((time - 1.45) / 0.72);

      // Keep the full animated core (including the central sphere) during the intro.
      // The sphere starts disappearing exactly when the first title line enters,
      // while the left/right structures separate only a little and keep moving.
      const revealAt = 2.86;
      const opening = reduceMotion ? 1 : easeInOut((time - revealAt) / 0.82);
      const centerClear = reduceMotion ? 1 : smooth((time - revealAt) / 0.40);
      const orbExit = reduceMotion ? 1 : smooth((time - revealAt) / 0.34);
      const revealKick = reduceMotion
        ? 0
        : Math.sin(clamp((time - revealAt) / 0.78) * Math.PI);
      const settle = reduceMotion ? 1 : easeOut((time - 3.58) / 1.00);
      const introFade = reduceMotion ? 1 : clamp(time / 0.52);
      // After the text appears, the side elements never freeze: they continue
      // rotating gently so the hero still feels alive without distracting from copy.
      const motionTime = time <= 3.75 ? time : 3.75 + (time - 3.75) * 0.24;

      const pointer = pointerRef.current;
      pointer.x = lerp(pointer.x, pointer.tx, 0.045);
      pointer.y = lerp(pointer.y, pointer.ty, 0.045);

      ctx.clearRect(0, 0, width, height);

      const coreSize = Math.min(width * 0.245, height * 0.395, 292);
      const cx = width * 0.5 + pointer.x * 14;
      const cy = height * 0.515 + pointer.y * 10;
      const tilt = -0.12 + pointer.x * 0.11;
      const postRevealBreath =
        !reduceMotion && opening > 0.96 ? Math.sin(rawTime * 0.82) * 0.028 : 0;
      const splitDistance =
        coreSize * (0.025 + 1.62 * opening + revealKick * 0.105 + postRevealBreath);
      const finalCalm = 1 - settle * 0.27;

      // Ambient background halo.
      ctx.save();
      const ambience = ctx.createRadialGradient(cx, cy, coreSize * 0.08, cx, cy, coreSize * 1.55);
      const ambienceFade = 1 - centerClear * 0.80;
      ambience.addColorStop(0, `rgba(121,44,255,${0.20 * introFade * ambienceFade})`);
      ambience.addColorStop(0.32, `rgba(102,0,252,${0.085 * introFade * ambienceFade})`);
      ambience.addColorStop(0.72, `rgba(119,45,255,${0.028 * introFade * ambienceFade})`);
      ambience.addColorStop(1, "rgba(102,0,252,0)");
      ctx.fillStyle = ambience;
      ctx.beginPath();
      ctx.arc(cx, cy, coreSize * 1.55, 0, TAU);
      ctx.fill();
      ctx.restore();

      drawPlatform(
        ctx,
        cx,
        cy,
        coreSize,
        (0.13 + 0.64 * assemble) * (1 - centerClear * 0.22),
        motionTime,
        Math.pow(1 - centerClear, 1.7),
      );

      // Large lateral secondary arcs.
      const lateralAlpha = introFade * (0.25 + 0.72 * assemble);
      [-1, 1].forEach((side, index) => {
        const sideX = cx + side * (coreSize * 0.12 + splitDistance * 0.94);
        const start = side < 0 ? Math.PI * 0.60 : -Math.PI * 0.40;
        const end = side < 0 ? Math.PI * 1.42 : Math.PI * 0.42;
        const arc = arcPoints(
          sideX,
          cy,
          coreSize * 1.17,
          0.68,
          start,
          end,
          tilt + side * 0.055,
          34,
        );
        strokePolyline(ctx, arc, {
          width: Math.max(1.3, coreSize * 0.015),
          stroke: index === 0 ? "rgba(211,184,255,.64)" : "rgba(106,18,249,.62)",
          alpha: lateralAlpha * (0.78 - settle * 0.18) * finalCalm,
          blur: 15,
        });
      });

      // Orbit curves.
      const orbitRotations = [-0.58, 0.43, 1.02];
      orbitRotations.forEach((rotation, i) => {
        const radius = coreSize * (1.04 + i * 0.16);
        const drift = Math.sin(motionTime * (0.28 + i * 0.07) + i) * 0.08;
        const orbit = arcPoints(
          cx,
          cy,
          radius,
          0.34 + i * 0.06,
          -Math.PI * 0.86 + drift,
          Math.PI * 0.78 + drift,
          rotation + tilt * 0.35,
          42,
        );
        strokePolyline(ctx, orbit, {
          width: i === 1 ? 1.25 : 1,
          stroke: i === 1 ? "rgba(126,40,255,.62)" : "rgba(172,121,255,.42)",
          alpha:
            introFade *
            (0.16 + assemble * 0.58) *
            (1 - centerClear * 0.84) *
            finalCalm,
          blur: i === 1 ? 8 : 4,
        });
      });

      // Main segmented rings.
      rings.forEach((ring, ringIndex) => {
        const r = coreSize * ring.radius;
        const thick = coreSize * ring.thickness;
        const gap = 0.115 + ringIndex * 0.012;
        const segmentSpan = TAU / ring.segments;
        for (let i = 0; i < ring.segments; i += 1) {
          const baseMid =
            ring.offset +
            i * segmentSpan +
            motionTime * ring.speed +
            revealKick * (i % 2 ? 0.055 : -0.055);
          // Keep each segment assigned to the same side after the split so it can
          // keep rotating without suddenly jumping across the title.
          const homeMid = ring.offset + i * segmentSpan;
          const midCos = Math.cos(homeMid);
          const side = Math.abs(midCos) < 0.06 ? (i % 2 ? 1 : -1) : Math.sign(midCos);
          const delay = ringIndex * 0.07 + i * 0.03;
          const localAssemble = smooth((assemble - delay) / Math.max(0.001, 1 - delay));
          const entrance = (1 - localAssemble) * coreSize * (0.28 + ringIndex * 0.18) * (i % 2 ? 1 : -1);
          const radialGrow = 0.68 + localAssemble * 0.32;
          const openX = side * splitDistance * (0.92 + ringIndex * 0.12);
          const openY =
            Math.sin(baseMid * 1.15) * opening * coreSize * 0.11 +
            Math.sin(baseMid * 2.0) * revealKick * coreSize * 0.035;
          const a0 = baseMid - segmentSpan * 0.5 + gap;
          const a1 = baseMid + segmentSpan * 0.5 - gap;

          drawRingSegment(ctx, {
            cx: cx + entrance + openX,
            cy: cy + openY + (1 - localAssemble) * Math.sin(baseMid) * coreSize * 0.16,
            radius: r * radialGrow,
            flatten: ring.flatten + pointer.y * 0.06,
            a0,
            a1,
            rotation:
              tilt +
              ringIndex * 0.035 +
              side * opening * 0.055 +
              side * revealKick * 0.035,
            thickness: thick,
            alpha:
              introFade *
              (0.10 + localAssemble * 0.90) *
              (1 - settle * 0.12) *
              finalCalm,
            glass: (i + ringIndex) % 2 === 0,
            depthOffset: Math.sin(baseMid) * coreSize * 0.018,
          });
        }
      });

      // Secondary thin glowing arcs.
      for (let i = 0; i < 4; i += 1) {
        const radius = coreSize * (0.78 + i * 0.11);
        const a0 = motionTime * (0.16 + i * 0.02) + i * 1.35;
        const a1 = a0 + Math.PI * (0.52 + i * 0.05);
        const side = i % 2 === 0 ? -1 : 1;
        const openX = side * splitDistance * 0.93;
        const arc = arcPoints(
          cx + openX,
          cy,
          radius,
          0.74,
          a0,
          a1,
          tilt - 0.04,
          25,
        );
        strokePolyline(ctx, arc, {
          width: Math.max(1.1, coreSize * 0.008),
          stroke: "rgba(190,145,255,.86)",
          alpha:
            introFade *
            (0.10 + assemble * 0.70) *
            (1 - centerClear * 0.28) *
            finalCalm,
          blur: 10,
        });
      }

      // The sphere stays fully present through the assembly/pulse phase, then fades
      // out as the headline enters. It is gone once the typography has settled.
      const orbAlpha = introFade * assemble * Math.pow(1 - orbExit, 1.55);
      const orbPulse =
        0.82 +
        assemble * 0.18 +
        (pulse > 0 ? Math.sin(motionTime * 4.0) * 0.018 * pulse : 0);
      if (orbAlpha > 0.002) {
        drawOrb(ctx, cx, cy, coreSize * 0.205, orbAlpha, orbPulse);
      }

      // Central flash + shockwave exactly when the typography breaks through.
      const flashProgress = clamp((time - revealAt) / 0.58);
      const flash = reduceMotion
        ? 0
        : Math.sin(flashProgress * Math.PI) *
          (1 - clamp((time - (revealAt + 0.50)) / 0.34));
      if (flash > 0) {
        ctx.save();
        const flashGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreSize * 0.64);
        flashGrad.addColorStop(0, `rgba(255,255,255,${0.88 * flash})`);
        flashGrad.addColorStop(0.1, `rgba(215,190,255,${0.62 * flash})`);
        flashGrad.addColorStop(0.34, `rgba(121,44,255,${0.30 * flash})`);
        flashGrad.addColorStop(1, "rgba(102,0,252,0)");
        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, coreSize * 0.64, 0, TAU);
        ctx.fill();

        ctx.strokeStyle = `rgba(255,255,255,${0.78 * flash})`;
        ctx.lineWidth = 1.4;
        ctx.shadowColor = "rgba(167,112,255,.9)";
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(cx, cy - coreSize * 0.7);
        ctx.lineTo(cx, cy + coreSize * 0.7);
        ctx.stroke();
        ctx.restore();
      }

      const shockProgress = reduceMotion ? 1 : clamp((time - (revealAt + 0.04)) / 0.82);
      if (!reduceMotion && shockProgress > 0 && shockProgress < 1) {
        const shockAlpha = Math.pow(1 - shockProgress, 1.8);
        const shockRadius = coreSize * (0.22 + shockProgress * 1.56);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(160,92,255,${0.48 * shockAlpha})`;
        ctx.lineWidth = 1.2 + (1 - shockProgress) * 2.0;
        ctx.shadowColor = "rgba(121,43,255,.75)";
        ctx.shadowBlur = 14 * shockAlpha;
        ctx.beginPath();
        ctx.ellipse(cx, cy, shockRadius, shockRadius * 0.53, tilt * 0.15, 0, TAU);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255,255,255,${0.34 * shockAlpha})`;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.ellipse(
          cx,
          cy,
          shockRadius * 0.78,
          shockRadius * 0.41,
          -0.16,
          0,
          TAU,
        );
        ctx.stroke();
        ctx.restore();
      }

      // Geometric fragments approach, then burst aside as the text enters.
      fragments.forEach((fragment, index) => {
        const ringRadius = rings[fragment.targetRing].radius * coreSize;
        const local = smooth((time - 0.08 - fragment.delay) / (1.75 + fragment.delay * 0.7));
        const startRadius = coreSize * fragment.outer;
        const targetRadius = ringRadius * (0.97 + (index % 4) * 0.04);
        const radius = lerp(startRadius, targetRadius, local);
        const angle =
          fragment.angle + motionTime * 0.05 * (index % 2 ? 1 : -1);
        const side = fragment.side;
        const debrisOut =
          opening * coreSize * (0.20 + (index % 5) * 0.04) +
          revealKick * coreSize * (0.06 + (index % 4) * 0.018);
        const x =
          cx +
          Math.cos(angle) * radius +
          side * splitDistance * 0.74 +
          side * debrisOut;
        const y = cy + Math.sin(angle) * radius * 0.72 + fragment.vertical * coreSize * (1 - local) - opening * fragment.vertical * coreSize * 0.22;
        const scale = 0.55 + local * 0.52;
        const debrisFade = 1 - opening * (0.46 + (index % 3) * 0.10);
        drawFragment(
          ctx,
          fragment,
          x,
          y,
          scale,
          fragment.phase + motionTime * fragment.spin + revealKick * side * 0.45,
          introFade * (0.12 + local * 0.88) * debrisFade,
        );
      });

      // Orbiting micro particles.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      particles.forEach((particle, index) => {
        const a = particle.angle + motionTime * particle.speed;
        const radius = coreSize * particle.radius * (0.55 + assemble * 0.45);
        const side = particle.side;
        const x =
          cx +
          Math.cos(a) * radius +
          side * splitDistance * (0.50 + (index % 4) * 0.022) +
          side * revealKick * coreSize * 0.045;
        const y = cy + Math.sin(a) * radius * 0.68 + Math.sin(a * 2.1 + particle.phase) * coreSize * particle.lift;
        const size =
          particle.size *
          (0.65 + 0.35 * Math.sin(motionTime * 1.7 + particle.phase) ** 2);
        let alpha =
          introFade *
          particle.alpha *
          (0.25 + assemble * 0.75) *
          (1 - centerClear * 0.34) *
          finalCalm;
        if (centerClear > 0) {
          const clearX = clamp(1 - Math.abs(x - cx) / (coreSize * 0.82));
          const clearY = clamp(1 - Math.abs(y - cy) / (coreSize * 0.54));
          alpha *= 1 - centerClear * clearX * clearY * 0.93;
        }
        ctx.fillStyle = `rgba(${index % 5 === 0 ? "224,202,255" : "119,42,255"},${alpha})`;
        ctx.shadowColor = "rgba(132,60,255,.78)";
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, TAU);
        ctx.fill();
      });
      ctx.restore();

      // After the reveal, the two separated side clusters keep breathing softly.
      // The middle stays clear for the headline, while the extremities remain alive.
      if (!reduceMotion && rawTime > 4.0) {
        const breathe = (Math.sin(rawTime * 1.1) + 1) * 0.5;
        [-1, 1].forEach((side) => {
          const hx = cx + side * splitDistance * 1.02;
          ctx.save();
          ctx.globalAlpha = 0.018 + breathe * 0.018;
          const g = ctx.createRadialGradient(hx, cy, 0, hx, cy, coreSize * 0.92);
          g.addColorStop(0, "rgba(112,30,255,.48)");
          g.addColorStop(1, "rgba(112,30,255,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(hx, cy, coreSize * 0.92, 0, TAU);
          ctx.fill();
          ctx.restore();
        });
      }

      // Once the copy enters, protect a generous central reading zone.
      // A blurred destination-out ellipse softly erases anything that still drifts
      // behind the headline/subtitle, while keeping the two edge clusters alive.
      if (centerClear > 0.001) {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = 0.985 * centerClear;
        ctx.filter = `blur(${Math.max(22, coreSize * 0.14)}px)`;
        ctx.fillStyle = "rgba(0,0,0,1)";
        ctx.beginPath();
        ctx.ellipse(
          cx,
          cy + height * 0.008,
          Math.min(width * 0.285, coreSize * 1.86),
          Math.min(height * 0.235, coreSize * 0.98),
          0,
          0,
          TAU,
        );
        ctx.fill();
        ctx.restore();
      }

    };

    raf = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [reduceMotion]);

  return (
    <div className="core-effect" aria-hidden="true">
      <canvas ref={canvasRef} className="core-effect__canvas" />
      <div className="core-effect__grain" />
    </div>
  );
}

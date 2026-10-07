// Shared with stories.js (hotspots, tour, kiosk, QR).
export const viewer = document.querySelector('model-viewer');
let resolveScreenVideo;
export const screenVideoReady = new Promise((resolve) => (resolveScreenVideo = resolve));

// === Loading screen ===
const loadingScreen = document.getElementById('loading-screen');
const loadingFill = loadingScreen.querySelector('.loading-fill');

const onProgress = (event) => {
  loadingFill.style.width = `${event.detail.totalProgress * 100}%`;
  if (event.detail.totalProgress === 1) viewer.removeEventListener('progress', onProgress);
};
viewer.addEventListener('progress', onProgress);

const hideLoadingScreen = () => {
  loadingScreen.classList.add('loaded');
  setTimeout(() => (loadingScreen.style.display = 'none'), 600);
};
if (viewer.loaded) {
  hideLoadingScreen();
} else {
  viewer.addEventListener('load', hideLoadingScreen, { once: true });
}
// If the 3D library itself fails to load, no 'error' fires; don't leave the loader up forever.
setTimeout(() => !viewer.loaded && hideLoadingScreen(), 20000);
// Hide on error too, so users see the poster instead of a stuck loader.
viewer.addEventListener('error', (error) => {
  console.error('Error loading model:', error);
  hideLoadingScreen();
});

// === Toast ===
const toast = document.getElementById('toast');
let toastTimer = 0;
export function showToast(message, ms = 1800) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
}

export function setPressed(button, pressed) {
  button.setAttribute('aria-pressed', String(pressed));
}

// === Share ===
document.getElementById('share-btn').addEventListener('click', async () => {
  const url = window.location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'MASSBOX® in 3D', text: 'Check out the MASSBOX® in 3D!', url });
    } else {
      await navigator.clipboard.writeText(url);
      showToast('Link copied');
    }
  } catch (err) {
    if (err.name !== 'AbortError') console.error('Error sharing:', err);
  }
});

// === Reset view ===
const homeOrbit = viewer.getAttribute('camera-orbit');
document.getElementById('reset-btn').addEventListener('click', () => {
  viewer.cameraOrbit = homeOrbit;
  viewer.cameraTarget = 'auto auto auto';
  viewer.fieldOfView = 'auto';
  viewer.resetTurntableRotation?.();
});

// === Theme (dark studio by default, saved per viewer) ===
const themeBtn = document.getElementById('theme-btn');
const themeColor = document.querySelector('meta[name="theme-color"]');
// Both themes use the same custom studio layout (overhead softbox + rim strips); light mode's
// room is brighter. The floor glow is strong on black, subtle on light grey.
function applyThemeToModel(theme) {
  const floor = viewer.model?.materials.find((m) => m.name === 'floor_glow');
  if (floor) {
    const [r, g, b] = floor.pbrMetallicRoughness.baseColorFactor;
    floor.pbrMetallicRoughness.setBaseColorFactor([r, g, b, theme === 'dark' ? 1 : 0.35]);
  }
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeBtn.dataset.tip = theme === 'dark' ? 'Light mode' : 'Dark mode';
  themeColor.content = theme === 'dark' ? '#0b0c0e' : '#e6e8eb';
  viewer.environmentImage = theme === 'dark' ? 'studio_dark.hdr' : 'studio_light.hdr';
  applyThemeToModel(theme);
}
viewer.addEventListener('load', () => applyThemeToModel(document.documentElement.dataset.theme));
applyTheme(document.documentElement.dataset.theme || 'dark');
themeBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('theme', next); } catch (e) { /* private mode: not saved */ }
});

// === Banana for scale ===
// The banana ships in the model fully transparent (alpha 0) so AR viewers skip it; fade it in/out.
const bananaBtn = document.getElementById('banana-btn');
let bananaOn = false;
let bananaFrame = 0;
bananaBtn.addEventListener('click', () => {
  const mats = viewer.model?.materials.filter((m) => m.name.startsWith('banana')) ?? [];
  if (!mats.length) return;
  bananaOn = !bananaOn;
  setPressed(bananaBtn, bananaOn);
  if (bananaOn) showToast('Banana ≈ 7.5 in (19 cm)');

  const from = mats[0].pbrMetallicRoughness.baseColorFactor[3]; // continue from mid-fade
  const to = bananaOn ? 1 : 0;
  const start = performance.now();
  mats.forEach((m) => m.setAlphaMode('BLEND'));
  cancelAnimationFrame(bananaFrame);
  const step = (now) => {
    const k = Math.min(1, (now - start) / 350);
    const alpha = from + (to - from) * k;
    mats.forEach((m) => {
      const [r, g, b] = m.pbrMetallicRoughness.baseColorFactor;
      m.pbrMetallicRoughness.setBaseColorFactor([r, g, b, alpha]);
    });
    if (k < 1) {
      bananaFrame = requestAnimationFrame(step);
    } else {
      mats.forEach((m) => m.setAlphaMode(bananaOn ? 'OPAQUE' : 'MASK'));
    }
  };
  bananaFrame = requestAnimationFrame(step);
});

// === Load-in effects ===
export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduceMotion) viewer.removeAttribute('auto-rotate');
viewer.addEventListener('load', () => {
  if (reduceMotion) return;

  // Glide the camera in from a wider angle.
  viewer.interpolationDecay = 220;
  viewer.cameraOrbit = '-25deg 84deg 150%';
  viewer.jumpCameraToGoal();
  requestAnimationFrame(() => (viewer.cameraOrbit = homeOrbit));
  setTimeout(() => (viewer.interpolationDecay = 50), 2500);
}, { once: true });

// === Dimensions ===
const dims = {
  x: { in: 41.5, cm: 105.4 },
  y: { in: 23.2, cm: 58.9 },
  z: { in: 26.8, cm: 68.1 },
};
const TICK = 7; // px, half-length of the end ticks
let showDims = false;
let unit = 'in';
let dimFrame = 0;

const dimToggle = document.getElementById('dim-toggle');
const unitToggle = document.getElementById('unit-toggle');
const dimOverlay = document.getElementById('dim-overlay');
// Outward direction of each dimension line in model space (x, z); a line shows
// while the camera is on that side of the model.
const FACING = { x: [0, 1], y: [-Math.SQRT1_2, Math.SQRT1_2], z: [1, 0] };
const axes = ['x', 'y', 'z'].map((axis) => {
  const [line, tick1, tick2] = document.getElementById(`dim-${axis}`).children;
  return {
    axis,
    facing: FACING[axis],
    group: document.getElementById(`dim-${axis}`),
    line, tick1, tick2,
    label: dimOverlay.querySelector(`.dim-label[data-axis="${axis}"]`),
    p1: viewer.querySelector(`[slot="hotspot-dim-${axis}-1"]`),
    p2: viewer.querySelector(`[slot="hotspot-dim-${axis}-2"]`),
  };
});

function renderLabels() {
  axes.forEach((a) => (a.label.textContent = `${dims[a.axis][unit]} ${unit}`));
}

dimToggle.addEventListener('click', () => {
  showDims = !showDims;
  setPressed(dimToggle, showDims);
  dimOverlay.classList.toggle('show', showDims);
  unitToggle.classList.toggle('show', showDims);
  cancelAnimationFrame(dimFrame);
  if (showDims) dimLoop();
});

unitToggle.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-unit]');
  if (!button) return;
  unit = button.dataset.unit;
  unitToggle.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b === button);
    setPressed(b, b === button);
  });
  renderLabels();
});

function setLine(el, x1, y1, x2, y2) {
  el.setAttribute('x1', x1); el.setAttribute('y1', y1);
  el.setAttribute('x2', x2); el.setAttribute('y2', y2);
}

function updateDimLines() {
  const rect = viewer.getBoundingClientRect();
  const center = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - rect.left, y: r.top + r.height / 2 - rect.top };
  };
  // Auto-rotate spins the model (turntable), not the camera, so subtract it.
  const theta = viewer.getCameraOrbit().theta - viewer.turntableRotation;
  const camX = Math.sin(theta);
  const camZ = Math.cos(theta);
  for (const a of axes) {
    const visible = a.facing[0] * camX + a.facing[1] * camZ > -0.15;
    a.group.classList.toggle('hidden', !visible);
    a.label.classList.toggle('hidden', !visible);
    if (!visible) continue;

    const p = center(a.p1);
    const q = center(a.p2);
    const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const nx = (-(q.y - p.y) / len) * TICK;
    const ny = ((q.x - p.x) / len) * TICK;
    setLine(a.line, p.x, p.y, q.x, q.y);
    setLine(a.tick1, p.x - nx, p.y - ny, p.x + nx, p.y + ny);
    setLine(a.tick2, q.x - nx, q.y - ny, q.x + nx, q.y + ny);
    a.label.style.left = `${(p.x + q.x) / 2}px`;
    a.label.style.top = `${(p.y + q.y) / 2}px`;
  }
}

// One loop while dimensions are visible (camera moves every frame during auto-rotate).
function dimLoop() {
  updateDimLines();
  dimFrame = requestAnimationFrame(dimLoop);
}

// === Video on the screen ===
// The video streams straight into a WebGL texture (createVideoTexture): no per-frame copy
// through a 2D canvas, which is slow in Safari. iOS Safari still needs muted + playsinline as
// attributes, the element attached to the document, and a tap fallback when autoplay is blocked.
viewer.addEventListener('load', () => {
  const screen = viewer.model.materials.find((m) => m.name === 'screen');
  if (!screen?.emissiveTexture) return;

  const videoTexture = viewer.createVideoTexture('vid.mp4');
  const video = videoTexture.source.element;
  video.preload = 'auto';
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  document.body.appendChild(video);
  resolveScreenVideo(video);

  // A display only emits light. Black base + metallic 1 means the surface reflects nothing
  // (no diffuse, zero specular), so the studio lighting can't lay a grey veil over the
  // picture. Applied right away so the still image before the video looks the same.
  screen.setEmissiveFactor([1, 1, 1]);
  screen.pbrMetallicRoughness.setBaseColorFactor([0, 0, 0, 1]);
  screen.pbrMetallicRoughness.setMetallicFactor(1);
  screen.pbrMetallicRoughness.setRoughnessFactor(1);

  // Swap in only once a real frame exists, so the still image shows until then.
  const apply = () => {
    screen.emissiveTexture.setTexture(videoTexture);
    // Video textures upload flipped relative to glTF UVs: flip V back.
    const { sampler } = screen.emissiveTexture.texture;
    sampler.setScale({ u: 1, v: -1 });
    sampler.setOffset({ u: 0, v: 1 });
  };
  if ('requestVideoFrameCallback' in video) {
    video.requestVideoFrameCallback(apply);
  } else {
    video.addEventListener('playing', apply, { once: true });
  }

  // If the browser blocks playback, try again on the next tap (a user gesture is allowed).
  const onGesture = () => video.play().catch(() => {});
  const play = () => video.play().catch(() => {
    ['pointerdown', 'touchend', 'click'].forEach((type) =>
      window.addEventListener(type, onGesture, { once: true, passive: true }));
  });
  play();
  // iOS pauses media on tab switches, calls and Low Power Mode; pick back up when visible.
  video.addEventListener('pause', () => !document.hidden && play());
  document.addEventListener('visibilitychange', () => !document.hidden && video.paused && play());
}, { once: true });

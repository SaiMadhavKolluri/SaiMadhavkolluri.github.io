// Points of interest, guided tour (loops as a kiosk), and "view in AR" QR for desktop.
import { viewer, screenVideoReady, setPressed, showToast, reduceMotion } from './script.js';

// Card wording follows the MASSBOX product video captions; clip = [start, end] seconds in vid.mp4.
// Orbits are in model space (the turntable is added at run time).
const STOPS = [
  { id: 'intro', title: 'Meet MASSBOX®', text: 'Simplifying solid material characterization.',
    orbit: '28deg 75deg 105%', target: 'auto auto auto', clip: [12, 24] },
  { id: 'screen', title: 'Full periodic table', text: 'Trace element detection and 3D elemental mapping, right on the touchscreen.',
    orbit: '6deg 84deg 1.35m', target: '-0.174m 0.377m 0.328m', clip: [25, 38] },
  { id: 'door', title: 'Load and go', text: 'No mirror polishing. No acid digestion. Pump down < 1 minute.',
    orbit: '28deg 70deg 1.25m', target: '0.23m 0.40m 0.288m', clip: [46, 71] },
  { id: 'apps', title: 'From mine to battery lab', text: 'Find critical minerals. Quantify elements, prevent failures, verify impurities. Map lithium distribution and characterize the SEI layer.',
    orbit: '-24deg 78deg 105%', target: 'auto auto auto', clip: [98, 133] },
  { id: 'ports', title: 'Field deployable', text: 'No hazardous consumables. No specialist operator. Single-phase power only.',
    orbit: '-112deg 76deg 0.95m', target: '-0.521m 0.16m -0.125m', clip: [134, 149] },
  { id: 'demo', title: 'See it on your samples', text: 'Book a demo with the Exum team.',
    orbit: '28deg 75deg 105%', target: 'auto auto auto', clip: [150, 159.5] }, // video ends at 160.03 s
];
const IDLE_RESTART = 30000; // kiosk: restart the tour after 30 s without a touch
const KIOSK = new URLSearchParams(location.search).has('kiosk');
const DEG = 180 / Math.PI;
const $ = (id) => document.getElementById(id);

// === Camera ===
function goTo(stop) {
  const [theta, phi, radius] = stop.orbit.split(' ');
  // Auto-rotate spins the model (turntable), so add it; then take the equivalent angle nearest
  // the current camera so the move never swings the long way round.
  const current = viewer.getCameraOrbit().theta * DEG;
  let t = parseFloat(theta) + viewer.turntableRotation * DEG;
  t += Math.round((current - t) / 360) * 360;
  viewer.interpolationDecay = 160;
  viewer.cameraOrbit = `${t}deg ${phi} ${radius}`;
  viewer.cameraTarget = stop.target;
  viewer.fieldOfView = 'auto';
}

// === Video clip on the 3D screen ===
let video = null;
let clip = null;
screenVideoReady.then((v) => {
  video = v;
  const keepInClip = (t) => {
    if (clip && (t >= clip[1] || t < clip[0] - 1)) video.currentTime = clip[0];
  };
  if ('requestVideoFrameCallback' in video) {
    // Checked every presented frame (timeupdate only fires ~4x a second and overshoots).
    const onFrame = (now, meta) => {
      keepInClip(meta.mediaTime);
      video.requestVideoFrameCallback(onFrame);
    };
    video.requestVideoFrameCallback(onFrame);
  } else {
    video.addEventListener('timeupdate', () => keepInClip(video.currentTime));
  }
  if (clip) playClip(clip);
});
function playClip(range) {
  clip = range;
  if (!video) return;
  video.currentTime = range[0];
  video.play().catch(() => {});
}

// === Card ===
const card = {
  root: $('story'), step: $('story-step'), title: $('story-title'), text: $('story-text'),
  prev: $('story-prev'), next: $('story-next'), tour: $('story-tour'),
};
function showCard(stop, index) {
  const inTour = index != null;
  card.step.textContent = inTour ? `${index + 1} / ${STOPS.length}` : '';
  card.title.textContent = stop.title;
  card.text.textContent = stop.text;
  card.prev.hidden = card.next.hidden = !inTour;
  card.tour.hidden = inTour;
  card.root.hidden = false;
  document.querySelectorAll('.poi').forEach((p) => p.classList.toggle('active', p.dataset.stop === stop.id));
}

// === Modes: free (auto-rotate), poi (one hotspot), tour (loops; kiosk) ===
const tourBtn = $('tour-btn');
let mode = 'free';
let index = 0;
let paused = false;
let advanceTimer = 0;
let idleTimer = 0;

function dwell(stop) {
  return Math.min(12000, Math.max(7000, (stop.clip[1] - stop.clip[0]) * 1000));
}
function enterStop(i) {
  index = (i + STOPS.length) % STOPS.length;
  const stop = STOPS[index];
  goTo(stop);
  playClip(stop.clip);
  showCard(stop, index);
  clearTimeout(advanceTimer);
  if (!paused) advanceTimer = setTimeout(() => enterStop(index + 1), dwell(stop));
}
function startTour() {
  mode = 'tour';
  paused = false;
  viewer.classList.add('touring');
  clearTimeout(idleTimer);
  viewer.autoRotate = false;
  setPressed(tourBtn, true);
  tourBtn.dataset.tip = 'Stop tour';
  enterStop(0);
}
function exitToFree() {
  mode = 'free';
  viewer.classList.remove('touring');
  clearTimeout(advanceTimer);
  clearTimeout(idleTimer);
  clip = null;
  card.root.hidden = true;
  document.querySelectorAll('.poi.active').forEach((p) => p.classList.remove('active'));
  setPressed(tourBtn, false);
  tourBtn.dataset.tip = 'Play tour';
  viewer.interpolationDecay = 50;
  if (!reduceMotion) viewer.autoRotate = true;
  armKiosk();
}
// Touching the model pauses the tour; after a quiet spell it starts over (kiosk reset).
function pauseTour() {
  paused = true;
  clearTimeout(advanceTimer);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { paused = false; enterStop(0); }, IDLE_RESTART);
}
// Kiosk links (?kiosk) also start the tour by themselves after a quiet spell outside the tour.
function armKiosk() {
  clearTimeout(idleTimer);
  if (KIOSK && mode !== 'tour') idleTimer = setTimeout(startTour, IDLE_RESTART);
}

tourBtn.addEventListener('click', () => (mode === 'tour' ? exitToFree() : startTour()));
$('story-close').addEventListener('click', () => {
  exitToFree();
  tourBtn.focus(); // the card is gone; keep keyboard focus somewhere sensible
});
$('story-tour').addEventListener('click', () => {
  startTour();
  card.next.focus();
});
// Prev/next only exist in the tour.
$('story-prev').addEventListener('click', () => { if (mode !== 'tour') return; pauseTour(); enterStop(index - 1); });
$('story-next').addEventListener('click', () => { if (mode !== 'tour') return; pauseTour(); enterStop(index + 1); });
$('reset-btn').addEventListener('click', () => mode !== 'free' && exitToFree());
viewer.addEventListener('camera-change', (event) => {
  if (event.detail.source !== 'user-interaction') return;
  viewer.interpolationDecay = 50; // tour moves use slow easing; hand back snappy controls
  if (mode === 'tour') pauseTour();
  else armKiosk();
});
['pointerdown', 'keydown'].forEach((type) => window.addEventListener(type, () => mode !== 'tour' && armKiosk(), { passive: true }));

// === Hotspots (off by default; the info button shows them) ===
const poiBtn = $('poi-btn');
poiBtn.addEventListener('click', () => {
  const on = viewer.classList.toggle('pois-on');
  setPressed(poiBtn, on);
  if (!on && mode === 'poi') exitToFree();
});
const pois =[...document.querySelectorAll('.poi')].map((el) => ({ el, n: el.dataset.normal.split(' ').map(Number) }));
pois.forEach(({ el }) => el.addEventListener('click', () => {
  const stop = STOPS.find((s) => s.id === el.dataset.stop);
  if (mode === 'tour') {
    pauseTour();
    enterStop(STOPS.indexOf(stop));
    return;
  }
  mode = 'poi';
  armKiosk();
  viewer.autoRotate = false;
  goTo(stop);
  playClip(stop.clip);
  showCard(stop);
}));
// Hide hotspots on the far side of the model (normals are in model space; subtract the turntable).
function updatePois() {
  const { theta, phi } = viewer.getCameraOrbit();
  const t = theta - viewer.turntableRotation;
  const cam = [Math.sin(phi) * Math.sin(t), Math.cos(phi), Math.sin(phi) * Math.cos(t)];
  for (const { el, n } of pois) el.classList.toggle('away', n[0] * cam[0] + n[1] * cam[1] + n[2] * cam[2] < 0.15);
  requestAnimationFrame(updatePois);
}
viewer.addEventListener('load', () => {
  requestAnimationFrame(updatePois);
  if (KIOSK) startTour();
}, { once: true });

// === "View in your space" on desktop: QR code that opens the page on a phone ===
const QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
const QR_SRI = 'sha384-mZT2gIty7ZDdOGkxfP6joZcYdMW1Jvj9dRlfpTmaJAKKXTqzygtB22k7FLe+KZC1';
const qrBtn = $('qr-btn');
const qrDialog = $('qr-dialog');
let qrLib = null;
function loadQrLib() {
  qrLib ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = QR_LIB;
    s.integrity = QR_SRI;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve(window.qrcode);
    s.onerror = (err) => {
      // Let the next click retry (blocked CDN, brief offline moment).
      qrLib = null;
      s.remove();
      reject(err);
    };
    document.head.appendChild(s);
  });
  return qrLib;
}
qrBtn.addEventListener('click', async () => {
  const box = $('qr-code');
  qrDialog.showModal();
  box.removeAttribute('role');
  try {
    const qrcode = await loadQrLib();
    const qr = qrcode(0, 'M');
    qr.addData(`${location.origin}${location.pathname}?ar`);
    qr.make();
    box.innerHTML = qr.createSvgTag(6, 2); // our own URL only: safe markup
    box.firstElementChild?.setAttribute('aria-hidden', 'true');
  } catch (err) {
    box.setAttribute('role', 'alert');
    box.textContent = 'Could not load the QR code. Open this page on your phone instead.';
  }
});
$('qr-close').addEventListener('click', () => qrDialog.close());
// Close only on a real backdrop click: the dialog's own padding also reports the dialog as target.
qrDialog.addEventListener('click', (event) => {
  const r = qrDialog.getBoundingClientRect();
  const inside = event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
  if (!inside) qrDialog.close();
});

viewer.addEventListener('load', () => {
  if (!viewer.canActivateAR) {
    // Only on desktops (mouse/trackpad); a phone without AR has no use for a QR code.
    qrBtn.hidden = !window.matchMedia('(pointer: fine)').matches;
  } else if (new URLSearchParams(location.search).has('ar')) {
    // Arrived from the desktop QR code: point at the AR button (AR itself needs a tap).
    const arBtn = $('ar-button');
    arBtn.classList.add('pulse');
    setTimeout(() => arBtn.classList.remove('pulse'), 6000);
    showToast('Tap “View in your space” to place it in your room', 5000);
  }
}, { once: true });

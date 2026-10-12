/* ---------- loading screen: tracks the 3D stage's real milestones, lifts once full-quality frames exist ---------- */
const loader = document.getElementById('loader');
const ldBar = document.getElementById('ldBar'), ldStep = document.getElementById('ldStep'), ldPct = document.getElementById('ldPct'), ldSkip = document.getElementById('ldSkip');
let ldShown = 0, ldDone = false;
function ldProgress(p, label) {
  ldShown = Math.max(ldShown, p);
  ldBar.style.transform = `scaleX(${Math.max(0.04, ldShown)})`;
  ldPct.textContent = Math.round(ldShown * 100) + '%';
  if (label) ldStep.textContent = label;
}
function ldFinish() {
  if (ldDone) return; ldDone = true;
  setTimeout(() => { loader.classList.add('done'); document.documentElement.classList.remove('is-loading'); }, 400);
}
function ldFail(msg) {
  if (ldDone) return;
  loader.classList.add('failed'); ldStep.textContent = msg; ldSkip.hidden = false;
}
ldProgress(0.08, 'Opening the cellar');
// keep the bar moving through long steps (shader compile), easing toward but never reaching the next milestone
const ldCreep = setInterval(() => { if (ldDone) return clearInterval(ldCreep); ldProgress(ldShown + (Math.min(0.96, ldShown + 0.12) - ldShown) * 0.06); }, 250);
addEventListener('stage-progress', e => ldProgress(e.detail.p, e.detail.label));
addEventListener('stage-ready', ldFinish);
addEventListener('error', () => ldFail('The 3D view could not load on this device'));
addEventListener('unhandledrejection', () => ldFail('The 3D view could not load on this device'));
setTimeout(() => { if (!ldDone) { ldSkip.hidden = false; ldStep.textContent = 'Still pouring\u2026'; } }, 20000);
ldSkip.addEventListener('click', () => { ldDone = false; ldFinish(); });

const stage    = document.getElementById('stage');
const sections = [...document.querySelectorAll('.ch[data-pose]')];
const tabs     = document.querySelector('.tabs');
const tabLinks = [...tabs.querySelectorAll('a')];
const dotsEl   = document.getElementById('dots');
const capNum   = document.getElementById('capNum');
const capName  = document.getElementById('capName');
const sheet    = document.querySelector('.content');
const sheetTitle = document.getElementById('sheetTitle');
const sheetToggle = document.getElementById('sheetToggle');

/* chapter dots */
sections.forEach(() => dotsEl.appendChild(document.createElement('li')));
const dots = [...dotsEl.children];

let current = 0;
function setChapter(i) {
  current = i;
  const s = sections[i];
  const pose = s.dataset.pose;
  if (stage.dataset.pose !== pose) stage.dataset.pose = pose;
  capNum.textContent = String(i).padStart(2, '0');
  capName.textContent = sheetTitle.textContent = s.dataset.name;
  dots.forEach((d, k) => d.classList.toggle('on', k === i));
  tabLinks.forEach(a => a.classList.toggle('on', a.dataset.for === s.id));
  tabs.classList.toggle('show', i > 0);
}

/* pick the active chapter:
   desktop: the section crossing the middle band of the viewport
   phone:   the text scrolls inside the bottom sheet, so watch the band near the top of the sheet */
const phone = matchMedia('(max-width: 900px)');
let io;
function observe() {
  if (io) io.disconnect();
  io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) setChapter(sections.indexOf(e.target)); });
  }, phone.matches ? { root: sheet, rootMargin: '-60px 0px -55% 0px' } : { rootMargin: '-45% 0px -45% 0px' });
  sections.forEach(s => io.observe(s));
}
phone.addEventListener('change', observe);
observe();
setChapter(0);

/* ---------- phone bottom sheet: 25% of the screen, expands to 75% over the 3D stage ---------- */
function setSheet(open) {
  sheet.classList.toggle('expanded', open);
  sheetToggle.setAttribute('aria-expanded', String(open));
  sheetToggle.querySelector('.st-label').textContent = open ? 'Collapse' : 'Expand';
  // keep the chapter being read at the top of the sheet
  if (open) sheet.scrollTo({ top: Math.max(0, sections[current].offsetTop - 96), behavior: 'smooth' });
}
document.querySelector('.sheet-bar').addEventListener('click', () => setSheet(!sheet.classList.contains('expanded')));
phone.addEventListener('change', () => { if (!phone.matches) setSheet(false); });

/* ---------- phone layout: scroll from anywhere ----------
   Only the sheet scrolls in this layout, so wheel and vertical swipes anywhere outside it
   (3D stage, top bar) are forwarded to the sheet. Horizontal drags on the 3D still rotate it. */
const inSheet = el => el instanceof Node && sheet.contains(el);
const scrollSheet = dy => sheet.scrollBy({ top: dy, behavior: 'instant' });

addEventListener('wheel', e => {
  if (!phone.matches || inSheet(e.target)) return;
  e.preventDefault();
  scrollSheet(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * sheet.clientHeight : e.deltaY);
}, { passive: false });

let touch = null, glide = 0;
addEventListener('touchstart', e => {
  if (!phone.matches || inSheet(e.target) || e.touches.length !== 1) { touch = null; return; }
  cancelAnimationFrame(glide);
  const t = e.touches[0];
  touch = { x0: t.clientX, y0: t.clientY, y: t.clientY, axis: null, v: 0, time: performance.now() };
}, { passive: true });
addEventListener('touchmove', e => {
  if (!touch) return;
  const t = e.touches[0], dx = t.clientX - touch.x0, dy = t.clientY - touch.y0;
  if (!touch.axis && Math.hypot(dx, dy) > 8) {
    touch.axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
    if (touch.axis === 'y') stage.classList.add('v-scroll');
  }
  if (touch.axis !== 'y') return;
  e.preventDefault();
  const now = performance.now(), step = touch.y - t.clientY;
  scrollSheet(step);
  touch.v = 0.8 * (step / Math.max(1, now - touch.time)) + 0.2 * touch.v;   // px per ms, smoothed
  touch.y = t.clientY; touch.time = now;
}, { passive: false });
addEventListener('touchend', () => {
  if (!touch) return;
  stage.classList.remove('v-scroll');
  if (touch.axis === 'y' && Math.abs(touch.v) > 0.05) {                     // momentum after a flick
    let v = touch.v, last = performance.now();
    const coast = now => {
      const dt = now - last; last = now;
      scrollSheet(v * dt); v *= Math.pow(0.94, dt / 16);
      if (Math.abs(v) > 0.02) glide = requestAnimationFrame(coast);
    };
    glide = requestAnimationFrame(coast);
  }
  touch = null;
});
addEventListener('touchcancel', () => { stage.classList.remove('v-scroll'); touch = null; });

/* ---------- buy panel ---------- */
const PRICES = { standard: 140, gift: 185 };
const radios       = [...document.querySelectorAll('input[name="edition"]')];
const engraveField = document.getElementById('engraveField');
const engraveInput = document.getElementById('engraveInput');
const qtyOut       = document.getElementById('qty');
const totalEl      = document.getElementById('total');
let qty = 1;

const edition = () => radios.find(r => r.checked).value;
const money = n => '$' + n.toLocaleString('en-US');

function refresh() {
  const gift = edition() === 'gift';
  engraveField.hidden = !gift;
  dispatchEvent(new CustomEvent('engrave', { detail: gift ? engraveInput.value.trim() : '' }));
  qtyOut.textContent = qty;
  totalEl.textContent = money(PRICES[edition()] * qty);
}
radios.forEach(r => r.addEventListener('change', refresh));
engraveInput.addEventListener('input', refresh);
document.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
  qty = Math.min(6, Math.max(1, qty + Number(b.dataset.q)));
  refresh();
}));
refresh();

/* ---------- cart (demo only) ---------- */
const cartCount = document.getElementById('cartCount');
const toast = document.getElementById('toast');
let cart = 0, toastTimer;

document.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', () => {
  const fromBuy = btn.dataset.add === 'selected';
  const n = fromBuy ? qty : 1;
  const ed = fromBuy ? edition() : 'standard';
  cart += n;
  cartCount.textContent = cart;
  cartCount.classList.add('bump');
  setTimeout(() => cartCount.classList.remove('bump'), 600);
  toast.textContent = `Added ${n} × ${ed === 'gift' ? 'Gift edition' : 'Eighteen Year Oloroso'}`;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}));

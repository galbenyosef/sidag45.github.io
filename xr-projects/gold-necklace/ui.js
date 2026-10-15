// Page UI for the Rivière d'Or product page. Plain script so it works when opened straight from Finder.
(function () {
const THEME = window.AURELLE_THEMES[0];
window.AURELLE = { theme: THEME };
window.dispatchEvent(new CustomEvent('aurelle:theme', { detail: THEME }));

/* ---------- reveal on scroll ---------- */
const io = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle('in', e.isIntersecting)), { threshold: 0.35 });
document.querySelectorAll('.chapter').forEach((el) => io.observe(el));

/* ---------- chapter rail ---------- */
const rail = document.querySelectorAll('.rail li');
let lastIdx = -1;
function onScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const s = (max > 0 ? window.scrollY / max : 0) * 7 * 1.04;
  const idx = Math.round(Math.min(7, Math.max(0, s)));
  if (idx !== lastIdx) { lastIdx = idx; rail.forEach((li) => li.classList.toggle('on', +li.dataset.i === idx)); }
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- product controls: metal, length, quantity, bag ---------- */
let qty = 1, bag = 0;
const out = document.getElementById('qtyVal');
const count = document.getElementById('bagCount');
document.querySelectorAll('[data-qty]').forEach((b) => b.addEventListener('click', () => {
  qty = Math.min(9, Math.max(1, qty + +b.dataset.qty));
  if (out) out.textContent = qty;
}));
document.querySelectorAll('.opt').forEach((group) => {
  group.querySelectorAll('.pick').forEach((p) => p.addEventListener('click', () => {
    group.querySelectorAll('.pick').forEach((x) => { x.classList.toggle('on', x === p); x.setAttribute('aria-pressed', x === p); });
    if (group.dataset.group === 'metal') window.dispatchEvent(new CustomEvent('aurelle:metal', { detail: p.dataset.metal }));
  }));
});
const saveBtn = document.querySelector('.btn.save');
if (saveBtn) saveBtn.addEventListener('click', () => {
  const on = saveBtn.getAttribute('aria-pressed') !== 'true';
  saveBtn.setAttribute('aria-pressed', on);
  saveBtn.textContent = on ? '♥ Saved' : '♡ Save';
});
document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
  bag += qty;
  if (count) count.textContent = bag;
  const label = b.textContent;
  b.textContent = 'Added to bag ✓';
  setTimeout(() => { b.textContent = label; }, 1600);
}));
})();

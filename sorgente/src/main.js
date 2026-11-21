import { createVisit } from './explore.js';
import { createStadium } from './stadium.js';
import { MATCH, SECTORS, TIERS, TARIFFS, BLOCK_PRICE, HOSP_BLOCKS, HOSPITALITY, UPSELL, MENU, AUTHOR } from './config.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const eur = v => (Math.round(v * 100) / 100).toLocaleString('it-IT', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
const num = v => v.toLocaleString('it-IT');
const params = new URLSearchParams(location.search);
const CREST = document.querySelector('.brand img').src;

function startStadium(){try{return createStadium($('#gl'), { noBloom: params.has('nobloom'), instant: params.has('instant'), lowPower: params.has('low') || window.innerWidth<=680 });}
  catch(error){document.body.dataset.view='unavailable';$('#loader p').textContent='La visita 3D richiede WebGL 2. Apri il file in un browser con accelerazione grafica attiva.';throw error;}}
const st=startStadium();
const visit=createVisit(st,()=>goIntro());
const { S } = st;

// ---------------- dati derivati ----------------
const blockPrice = no => BLOCK_PRICE[no] ?? S.blocks.get(no).sector.price;
const SEC_STATS = SECTORS.map(sec => {
  let free = 0, total = 0, min = Infinity;
  for (const no of sec.blocks) { const b = S.blocks.get(no); if (b.hosp) continue; free += b.free; total += b.total; min = Math.min(min, blockPrice(no) ?? Infinity); }
  return { free, total, min };
});
const tierStats = t => SECTORS.reduce((a, sec, i) => sec.tier === t ? { free: a.free + SEC_STATS[i].free, total: a.total + SEC_STATS[i].total, min: Math.min(a.min, SEC_STATS[i].min) } : a, { free: 0, total: 0, min: Infinity });
const hospBlock = S.blocks.get(HOSP_BLOCKS[0]);
const seatLabel = i => ({ block: S.BLK[i], row: S.ROW[i], num: S.NUM[i] });
const tierOf = no => S.blocks.get(no).hosp ? 'R' : S.blocks.get(no).sector.tier;

const app = { view: 'loading', block: null, qty: 2, sel: [], tariff: {}, hoverWin: null, purchased: null, order: {}, mode: 'pickup', when: 'pre', hosp: { pack: 'onore', people: 2 }, orderCode: null };
window.__app = { MAP: null, app, st, go: v => go(v), openBlock: (...a) => openBlock(...a), goSeat: () => goSeat(), buy: () => buy(), openOrder: () => openOrder(), confirmOrder: () => confirmOrder(), openHosp: () => openHosp(), autoPick: (no, q) => autoPick(no, q) };

// ---------------- testi fissi ----------------
$('#barMatch').textContent = `${MATCH.home}–${MATCH.away}, ${MATCH.dateShort}`;
$('#introComp').textContent = `${MATCH.competition}, ${MATCH.round}`;
$('#introTitle .home b').textContent = MATCH.home;
$('#introTitle .away b').textContent = MATCH.away;
$('#introWhen').textContent = `${MATCH.dateLong}, ore ${MATCH.kickoff}. ${MATCH.venue}, apertura cancelli alle ${MATCH.gatesOpen}.`;
$('#introNote').textContent = MATCH.note;
$('#conceptNote').textContent = 'Proposta non ufficiale · Posti, prezzi e disponibilità dimostrativi';
$('.credit').textContent = `Progetto di ${AUTHOR}`;
const tierRows = ['E', 'P', 'F'].map(tier => {
  const stats = tierStats(tier);
  const available = stats.total ? Math.round(100 * stats.free / stats.total) : 0;
  return `<tr><th scope="row">${TIERS[tier].name}</th><td>da ${eur(stats.min)}</td><td>${num(stats.free)} posti liberi<span class="availability" aria-hidden="true"><i style="width:${available}%"></i></span></td></tr>`;
});
tierRows.push(`<tr><th scope="row">Hospitality</th><td>su richiesta</td><td>${HOSPITALITY.name}, Executive Box</td></tr>`);
$('#introTiers').innerHTML = tierRows.join('');

// ---------------- navigazione ----------------
const STEP = { plan: 1, sector: 2, hosp: 2, seat: 3, done: 3, order: 4, wallet: 4 };
function go(v) {
  if(app.view==='visit' && v!=='visit')visit.leave();
  const canvas = $('#gl');
  if(canvas.parentNode!==document.body)document.body.prepend(canvas);
  app.view = v; document.body.dataset.view = v;
  if(v==='visit')visit.enter();
  const s = STEP[v] || 0; $$('.steps li').forEach(li => { const n = +li.dataset.s; li.classList.toggle('on', n === s); li.classList.toggle('ok', n < s); });
  if (v !== 'plan' && v !== 'sector') hideTip();
}
const desktop = () => window.innerWidth > 860;
const legendW = () => desktop() ? 380 : 0, drawerW = () => desktop() ? 480 : 0, sheetH = f => desktop() ? 0 : window.innerHeight * f;
let toastT; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3600); }

function resetHighlights() { Object.assign(st.state, { hover: null, focusSector: null, focusBlock: null, dimOthers: false }); st.state.sel.clear(); st.setPins([]); st.paint(); }

function goIntro() {
  go('intro'); resetHighlights(); st.setRoof(0.9);
  st.setMode('orbit');
}
async function goPlan() {
  go('plan'); app.sel = []; resetHighlights(); st.setRoof(0.05); st.setMode('fly');
  await st.flyTo(st.views.plan(legendW(), sheetH(0.46)), 2.2, 40); if (app.view === 'plan') st.setMode('plan');
}

// ---------------- legenda e etichette ----------------
{
  const groups = [['Curve', 'E'], ['Distinti', 'P'], ['Tribune', 'F']];
  let html = groups.map(([g, t]) => `<div class="lg-group"><h3>${g}</h3>${SECTORS.map((sec, si) => sec.tier !== t ? '' : `<button class="lg-row" data-si="${si}" type="button"><b>${sec.name}</b><span class="pr">da ${eur(SEC_STATS[si].min)}</span><span class="av">${num(SEC_STATS[si].free)} posti liberi su ${num(SEC_STATS[si].total)}${sec.noReductions ? ', solo biglietto intero' : ''}</span></button>`).join('')}</div>`).join('');
  html += `<div class="lg-group"><h3>Hospitality</h3><button class="lg-row" data-hosp type="button"><b>${HOSPITALITY.name}</b><span class="pr">su richiesta</span><span class="av">${HOSPITALITY.where}</span></button></div>`;
  const away = SECTORS.findIndex(s => s.away);
  html += `<div class="lg-group"><h3>Ospiti</h3><div class="lg-row off"><b>${SECTORS[away].name}</b><span class="pr"></span><span class="av">Riservato ai tifosi della squadra ospite, non in vendita qui</span></div></div>`;
  $('#legendList').innerHTML = html;
  $$('.lg-row[data-si]').forEach(b => {
    const si = +b.dataset.si;
    b.addEventListener('mouseenter', () => { st.state.hover = { type: 'sector', si }; st.paint(); labelHot(si); });
    b.addEventListener('mouseleave', () => { st.state.hover = null; st.paint(); labelHot(null); });
    b.addEventListener('click', () => openBlock(bestBlock(si)));
  });
  $('.lg-row[data-hosp]').addEventListener('click', openHosp);
  $('.lg-row[data-hosp]').addEventListener('mouseenter', () => { st.state.hover = { type: 'block', no: hospBlock.no }; st.paint(); });
  $('.lg-row[data-hosp]').addEventListener('mouseleave', () => { st.state.hover = null; st.paint(); });
}
const LABELS = SECTORS.map((sec, si) => {
  const el = document.createElement('span'); el.textContent = sec.short; $('#labels').appendChild(el);
  const u = (sec.u[0] + sec.u[1]) / 2, p = st.pt(st.G.R0 + st.G.DEPTH + 14, u).setY(st.G.TOP + 4);
  return { el, p, si };
});
{ const el = document.createElement('span'); el.textContent = "Tribuna d'Onore"; $('#labels').appendChild(el); LABELS.push({ el, p: st.pt(st.G.R0 - 2, hospBlock.uMid).setY(st.G.BASE + 6), si: -1 }); }
function labelHot(si) { LABELS.forEach(l => l.el.classList.toggle('hot', l.si === si)); }
st.onFrame(() => {
  if(app.view==='visit'){visit.frame();return;}
  if (app.view !== 'plan') return;
  for (const l of LABELS) { const s = st.project(l.p); l.el.style.left = s.x + 'px'; l.el.style.top = s.y + 'px'; }
});

function bestBlock(si) {
  const sec = SECTORS[si]; let best = null, bf = -1;
  sec.blocks.forEach((no, i) => { const b = S.blocks.get(no); if (b.hosp) return; const centre = 1 - Math.abs(i - (sec.blocks.length - 1) / 2) / sec.blocks.length; const sc = b.free / b.total + centre * 0.25; if (sc > bf) { bf = sc; best = no; } });
  return best;
}

// ---------------- hover sul 3D ----------------
const tip = $('#tip');
function hideTip() { tip.classList.remove('show'); }
function showTip(x, y, html) { tip.innerHTML = html; tip.classList.add('show'); const w = tip.offsetWidth, h = tip.offsetHeight; tip.style.left = Math.min(window.innerWidth - w - 12, x + 18) + 'px'; tip.style.top = Math.max(80, y - h - 14) + 'px'; }
let lastHoverKey = null;
$('#gl').addEventListener('pointermove', e => {
  if (app.view === 'seat' && dragging) return;
  if (app.view !== 'plan' && app.view !== 'sector') return;
  if (st.isAnimating()) return;
  const no = st.pickBlock(e.clientX, e.clientY);
  if (no == null) { if (lastHoverKey !== null) { lastHoverKey = null; st.state.hover = null; st.paint(); labelHot(null); } hideTip(); $('#gl').style.cursor = 'default'; return; }
  const b = S.blocks.get(no), sec = b.sector;
  const key = app.view === 'plan' ? (b.hosp ? 'h' : 's' + b.si) : 'b' + no;
  if (key !== lastHoverKey) {
    lastHoverKey = key;
    st.state.hover = app.view === 'plan' && !b.hosp ? { type: 'sector', si: b.si } : (no === app.block ? null : { type: 'block', no });
    st.paint(); labelHot(app.view === 'plan' && !b.hosp ? b.si : null);
  }
  $('#gl').style.cursor = sec.away ? 'not-allowed' : 'pointer';
  if (sec.away) showTip(e.clientX, e.clientY, `<b>${sec.short}</b><div class="m">Riservato ai tifosi ospiti, non in vendita.</div>`);
  else if (b.hosp) showTip(e.clientX, e.clientY, `<b>${HOSPITALITY.name}</b><div class="r"><span>Blocco ${no}</span><em>su richiesta</em></div><div class="m">Posti premium e box con servizio dedicato</div>`);
  else if (app.view === 'plan') showTip(e.clientX, e.clientY, `<b>${sec.name}</b><div class="r"><span>Blocco ${no}</span><em>da ${eur(SEC_STATS[b.si].min)}</em></div><div class="m">${num(SEC_STATS[b.si].free)} posti liberi nel settore</div>`);
  else showTip(e.clientX, e.clientY, `<b>Blocco ${no}</b><div class="r"><span>${sec.short}</span><em>${eur(blockPrice(no))}</em></div><div class="m">${num(b.free)} posti liberi</div>`);
});
$('#gl').addEventListener('pointerleave', hideTip);
$('#gl').addEventListener('click', e => {
  if ((app.view !== 'plan' && app.view !== 'sector') || st.isAnimating()) return;
  const no = st.pickBlock(e.clientX, e.clientY); if (no == null) return;
  const b = S.blocks.get(no);
  if (b.sector.away) return toast('Il settore ospiti è riservato ai tifosi della squadra ospite.');
  if (b.hosp) return openHosp();
  if (no !== app.block) openBlock(no);
});

// ---------------- settore e posti ----------------
async function openBlock(no, { autoPickSeats = false } = {}) {
  const b = S.blocks.get(no); if (!b || b.sector.away) return; if (b.hosp) return openHosp();
  const switching = app.view === 'sector';
  app.block = no; app.sel = []; app.tariff = {}; hideTip(); lastHoverKey = null;
  Object.assign(st.state, { hover: null, focusSector: b.si, focusBlock: no, dimOthers: true }); st.state.sel.clear(); st.setPins([]);
  if (autoPickSeats) autoPick(no, app.qty);
  st.paint(); go('sector'); st.setRoof(0.1); renderSeatPanel();
  st.setMode('fly'); await st.flyTo(st.views.block(no, drawerW(), sheetH(0.62)), switching ? 1.2 : 1.9, switching ? 0 : 20);
}
function renderSeatPanel() {
  const b = S.blocks.get(app.block), sec = b.sector;
  $('#spTitle').textContent = sec.name;
  $('#spSub').textContent = `Blocco ${b.no}, ${eur(blockPrice(b.no))} a posto. ${num(b.free)} posti liberi.`;
  $('#spBlocks').innerHTML = sec.blocks.filter(n => !S.blocks.get(n).hosp).map(n => `<button type="button" role="tab" aria-selected="${n === b.no}" data-b="${n}"><b>Blocco ${n}</b><small>${num(S.blocks.get(n).free)} liberi</small></button>`).join('');
  $$('#spBlocks button').forEach(x => x.addEventListener('click', () => openBlock(+x.dataset.b)));
  $('#qtyOut').textContent = app.qty;
  drawSeatMap(); renderSelection();
}
$$('[data-q]').forEach(x => x.addEventListener('click', () => { app.qty = Math.max(1, Math.min(4, app.qty + +x.dataset.q)); $('#qtyOut').textContent = app.qty; if (app.sel.length && app.sel.length !== app.qty) { const s = app.sel[0]; selectAt(rowOfSeat(s), seatPos(s)); } }));

const MAP = { cell: 10, ox: 0, oy: 0, rows: 0 };
function rowOfSeat(i) { return S.ROW[i] - 1; }
function seatPos(i) { return S.NUM[i] - 1; }
function drawSeatMap() {
  const b = S.blocks.get(app.block), cv = $('#seatmap'), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.parentElement.clientWidth - 44, maxN = Math.max(...b.rows.map(r => r.length)), lab = 26;
  const cell = Math.max(5, Math.min(13, (W - lab) / maxN));
  const c2 = Math.min(cell, desktop() ? 7.6 : 6.4);
  const HH = Math.round(b.rows.length * c2 + 22);
  cv.style.width = W + 'px'; cv.style.height = HH + 'px'; cv.width = W * dpr; cv.height = HH * dpr;
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, HH);
  window.__app.MAP = MAP; Object.assign(MAP, { cellX: cell, cellY: c2, lab, W, rows: b.rows.length, HH });
  const sel = new Set(app.sel), win = new Set(app.hoverWin || []);
  x.font = '600 10px Archivo, sans-serif'; x.textAlign = 'right'; x.textBaseline = 'middle';
  b.rows.forEach((row, r) => {
    const y = HH - 3 - (r + 0.5) * c2, cw = cell, x0 = lab + (W - lab - row.length * cw) / 2;
    if ((r + 1) % 5 === 0 || r === 0) { x.fillStyle = 'rgba(238,230,214,0.45)'; x.fillText(String(r + 1), lab - 6, y); }
    row.forEach((i, k) => {
      x.fillStyle = sel.has(i) ? '#f0bc42' : S.OCC[i] ? '#4a3f42' : win.has(i) ? '#f6dc9a' : '#cdbfa8';
      const sw = Math.max(2, cw * 0.78), sh = Math.max(2, c2 * 0.74);
      x.beginPath(); x.roundRect(x0 + k * cw + (cw - sw) / 2, y - sh / 2, sw, sh, Math.min(2.5, sw / 3)); x.fill();
    });
  });
  x.textAlign = 'right'; x.fillStyle = 'rgba(238,230,214,0.45)'; x.fillText('Fila', lab - 6, 7);
}
function seatAtXY(px, py) {
  const b = S.blocks.get(app.block); if (!b) return null;
  const r = Math.floor((MAP.HH - 3 - py) / MAP.cellY); if (r < 0 || r >= b.rows.length) return null;
  const row = b.rows[r], x0 = MAP.lab + (MAP.W - MAP.lab - row.length * MAP.cellX) / 2, k = Math.floor((px - x0) / MAP.cellX);
  return k >= 0 && k < row.length ? [r, k] : null;
}
function windowAt(r, k, q) {
  const row = S.blocks.get(app.block).rows[r];
  for (const s of [k, ...Array.from({ length: q - 1 }, (_, d) => k - d - 1)]) {
    if (s < 0 || s + q > row.length) continue;
    const w = row.slice(s, s + q); if (w.every(i => !S.OCC[i])) return w;
  }
  return null;
}
const cv = $('#seatmap');
cv.addEventListener('pointermove', e => {
  const r = cv.getBoundingClientRect(), hit = seatAtXY(e.clientX - r.left, e.clientY - r.top);
  const w = hit ? windowAt(hit[0], hit[1], app.qty) : null, key = w ? w.join() : '';
  if (key !== (app.hoverWin || []).join()) { app.hoverWin = w; drawSeatMap(); }
  cv.style.cursor = hit ? (w ? 'pointer' : 'not-allowed') : 'default';
});
cv.addEventListener('pointerleave', () => { app.hoverWin = null; drawSeatMap(); });
cv.addEventListener('click', e => { const r = cv.getBoundingClientRect(), hit = seatAtXY(e.clientX - r.left, e.clientY - r.top); if (hit) selectAt(hit[0], hit[1]); });
function selectAt(r, k) {
  const w = windowAt(r, k, app.qty);
  if (!w) { toast(app.qty > 1 ? `In questa fila non ci sono ${app.qty} posti liberi vicini. Prova un'altra fila o meno biglietti.` : 'Questo posto è già occupato.'); return; }
  setSelection(w);
}
function setSelection(w) {
  app.sel = w; const t = {}; w.forEach(i => t[i] = app.tariff[i] || 'full'); app.tariff = t;
  st.state.sel = new Set(w); st.paint(); st.setPins(w); renderSelection(); drawSeatMap();
}
function autoPick(no, q) {
  const b = S.blocks.get(no), order = b.rows.map((_, r) => r).sort((a, c) => Math.abs(a - 17) - Math.abs(c - 17));
  for (const r of order) { const row = b.rows[r], mid = row.length / 2; const ks = row.map((_, k) => k).sort((a, c) => Math.abs(a - mid) - Math.abs(c - mid)); for (const k of ks) { if (k + q > row.length) continue; const w = row.slice(k, k + q); if (w.every(i => !S.OCC[i])) { app.sel = w; app.tariff = Object.fromEntries(w.map(i => [i, 'full'])); st.state.sel = new Set(w); st.setPins(w); return w; } } }
}
function price(i) { const k = TARIFFS.find(t => t.id === app.tariff[i]).k; return blockPrice(S.BLK[i]) * k; }
const total = () => app.sel.reduce((a, i) => a + price(i), 0);
function renderSelection() {
  const b = S.blocks.get(app.block), noRed = b.sector.noReductions;
  if (!app.sel.length) { $('#spSel').innerHTML = `<p class="note">Clicca un posto libero sulla mappa: scegliamo ${app.qty > 1 ? `${app.qty} posti vicini nella stessa fila` : 'quel posto'}.</p>`; }
  else {
    $('#spSel').innerHTML = app.sel.map(i => `<div class="selrow"><span class="lab"><b>Fila ${S.ROW[i]}, posto ${S.NUM[i]}</b><small>${eur(price(i))}</small></span>${noRed ? '<span class="fine">Intero</span>' : `<div class="seg" role="group" aria-label="Tariffa">${TARIFFS.map(t => `<button type="button" data-i="${i}" data-t="${t.id}" aria-pressed="${app.tariff[i] === t.id}">${t.label}</button>`).join('')}</div>`}</div>`).join('') + (noRed ? '<p class="note">In Curva Sud le riduzioni non sono previste.</p>' : '');
    $$('#spSel .seg button').forEach(x => x.addEventListener('click', () => { app.tariff[+x.dataset.i] = x.dataset.t; renderSelection(); }));
  }
  $('#spTotal').textContent = eur(total());
  $('#viewBtn').disabled = !app.sel.length;
}
$('#viewBtn').addEventListener('click', () => goSeat());

// ---------------- vista dal posto ----------------
function seatsText(sel) { const nums = sel.map(i => S.NUM[i]); return nums.length > 1 ? `${nums[0]}–${nums[nums.length - 1]}` : String(nums[0]); }
function qrDraw(canvas, seed, size = 210) {
  const c = canvas; c.width = c.height = size; const x = c.getContext('2d'), N = 25, m = size / N; x.fillStyle = '#eee6d6'; x.fillRect(0, 0, size, size); x.fillStyle = '#231015';
  let h = seed >>> 0; const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const f = (i < 8 && j < 8) || (i > 16 && j < 8) || (i < 8 && j > 16); if (!f && rnd() < 0.48) x.fillRect(i * m, j * m, m + 0.4, m + 0.4); }
  for (const [i, j] of [[0, 0], [18, 0], [0, 18]]) { x.fillRect(i * m, j * m, 7 * m, 7 * m); x.fillStyle = '#eee6d6'; x.fillRect((i + 1) * m, (j + 1) * m, 5 * m, 5 * m); x.fillStyle = '#231015'; x.fillRect((i + 2) * m, (j + 2) * m, 3 * m, 3 * m); }
}
function ticketHTML(sel, { hosp = false, people = 0, totalV } = {}) {
  const i = sel[0], b = S.blocks.get(S.BLK[i]), sec = b.sector;
  const day = MATCH.dateLong.split(' ').slice(0, 3).join(' ');
  return `<article class="ticket${hosp ? ' onore' : ''}">
    <div class="t-main">
      <div class="t-head"><img src="${CREST}" alt=""><div class="m"><b>${MATCH.home}–${MATCH.away}</b><span>${MATCH.competition}, ${MATCH.round}</span></div><time><b>${MATCH.kickoff}</b>${day}</time></div>
      <dl class="t-grid">
        <div><dt>Settore</dt><dd class="s">${hosp ? HOSPITALITY.name : sec.name}</dd></div>
        <div><dt>Blocco</dt><dd>${b.no}</dd></div>
        <div><dt>Fila</dt><dd>${S.ROW[i]}</dd></div>
        <div><dt>${sel.length > 1 ? 'Posti' : 'Posto'}</dt><dd${hosp ? ' class="s"' : ''}>${hosp ? 'assegnato dal club' : seatsText(sel)}</dd></div>
        <div class="wide"><dt>Ingresso</dt><dd>${sec.gate}, cancelli aperti dalle ${MATCH.gatesOpen}</dd></div>
        <div class="wide"><dt>Titolare</dt><dd>${hosp ? 'Indicato in fase di conferma' : 'Da indicare prima della partita: il biglietto è nominativo'}</dd></div>
      </dl>
    </div>
    <div class="t-stub"><canvas data-qr="${i}"></canvas><small>QR di esempio</small><span class="n">${hosp ? `${people} persone` : sel.length > 1 ? `${sel.length} biglietti` : '1 biglietto'}</span><strong>${totalV == null ? 'su richiesta' : eur(totalV)}</strong></div>
  </article>`;
}
function paintQRs(root) { root.querySelectorAll('canvas[data-qr]').forEach(c => qrDraw(c, +c.dataset.qr * 2654435761 + 7)); }

async function goSeat({ hosp = false } = {}) {
  const sel = hosp ? [hospViewSeat()] : app.sel; if (!sel.length) return;
  go('seat'); hideTip(); st.setPins([]); Object.assign(st.state, { hover: null, focusSector: null, focusBlock: null, dimOthers: false }); st.paint();
  st.setRoof(0.94); $('#ticketSlot').innerHTML = ''; $('#seatActions').innerHTML = '';
  const mid = sel[Math.floor((sel.length - 1) / 2)];
  st.setMode('fly'); await st.flyTo(st.views.seat(mid), 2.4, 26); if (app.view !== 'seat') return; st.setMode('seat');
  const tier = hosp ? 'R' : tierOf(S.BLK[sel[0]]);
  $('#ticketSlot').innerHTML = hosp ? ticketHTML(sel, { hosp: true, people: app.hosp.people, totalV: null }) : ticketHTML(sel, { totalV: total() });
  paintQRs($('#ticketSlot'));
  let acts = hosp ? `<button class="btn gold" id="aReq" type="button">Richiedi disponibilità</button><button class="btn ghost" id="aBack" type="button">Torna ai pacchetti</button>`
    : `<button class="btn gold" id="aBuy" type="button">Acquista ${sel.length > 1 ? sel.length + ' biglietti' : 'il biglietto'}, ${eur(total())}</button>`;
  const next = TIERS[tier].next, up = UPSELL[tier];
  if (!hosp && next && up) {
    const ub = S.blocks.get(up), label = next === 'R' ? `Scopri la ${HOSPITALITY.name}` : `Prova ${ub.sector.name}, blocco ${up}, ${eur(blockPrice(up))}`;
    acts += `<button class="btn ghost" id="aUp" type="button">${label}</button>`;
  }
  $('#seatActions').innerHTML = acts;
  $('#aBuy')?.addEventListener('click', buy);
  $('#aReq')?.addEventListener('click', requestHosp);
  $('#aBack')?.addEventListener('click', openHosp);
  $('#aUp')?.addEventListener('click', () => next === 'R' ? openHosp() : openBlock(up, { autoPickSeats: true }));
  app.lastSeatHosp = hosp;
}
$('#changeSeat').addEventListener('click', () => app.lastSeatHosp ? openHosp() : openBlock(app.block));
// guardarsi intorno
let dragging = false, dx0 = 0, dy0 = 0, y0 = 0, p0 = 0;
$('#gl').addEventListener('pointerdown', e => { if (app.view !== 'seat' || st.isAnimating()) return; dragging = true; dx0 = e.clientX; dy0 = e.clientY; y0 = st.cam.look.yaw; p0 = st.cam.look.pitch; $('#gl').setPointerCapture(e.pointerId); });
$('#gl').addEventListener('pointermove', e => { if (!dragging) return; st.cam.look.yaw = Math.max(-1.3, Math.min(1.3, y0 + (e.clientX - dx0) * 0.0035)); st.cam.look.pitch = Math.max(-0.45, Math.min(0.55, p0 + (e.clientY - dy0) * 0.003)); });
window.addEventListener('pointerup', () => { dragging = false; });

// ---------------- acquisto ----------------
function buy() {
  const sel = app.sel.slice(), t = total(), b = S.blocks.get(S.BLK[sel[0]]);
  app.purchased = { sel, total: t, block: b.no, sector: b.sector, tier: tierOf(b.no) };
  go('done');
  $('#done').innerHTML = `<div class="sheet"><span class="tag">Acquisto simulato: nessun pagamento</span>
    <h2>Biglietti confermati</h2>
    <p class="lead">${sel.length > 1 ? `${sel.length} biglietti` : 'Un biglietto'} per ${MATCH.home}–${MATCH.away}: ${b.sector.name}, blocco ${b.no}, fila ${S.ROW[sel[0]]}, ${sel.length > 1 ? 'posti' : 'posto'} ${sel.map(i => S.NUM[i]).join(', ')}. Totale ${eur(t)}.</p>
    <div class="stack">${ticketHTML(sel, { totalV: t })}</div>
    <p class="callout">Ogni biglietto è nominativo: indica il nome del titolare entro il giorno della partita. Puoi cambiarlo dalla sezione Biglietti, se il club lo consente per questa gara.</p>
    <div class="row"><button class="btn gold" id="dOrder" type="button">Ordina da mangiare per la partita</button><button class="btn link" id="dRestart" type="button">Ricomincia la demo</button></div></div>`;
  paintQRs($('#done'));
  $('#dOrder').addEventListener('click', openOrder); $('#dRestart').addEventListener('click', restart);
}

// ---------------- ordini al posto ----------------
const premiumTier = t => t === 'F' || t === 'R';
function openOrder() {
  const p = app.purchased; if (!p) return;
  if (!premiumTier(p.tier) && app.mode === 'seat') app.mode = 'pickup';
  go('order');
  $('#opSub').textContent = `${p.sector.name}, blocco ${p.block}, fila ${S.ROW[p.sel[0]]}`;
  renderOrder();
}
const allItems = MENU.flatMap(c => c.items);
function renderOrder() {
  const p = app.purchased;
  $('#opMenu').innerHTML = MENU.map(c => `<h3>${c.cat}</h3>${c.items.map(it => `<div class="item"><span><b>${it.name}</b><small>${it.desc}</small></span><span class="pr">${eur(it.price)}</span><div class="stepper"><button type="button" data-o="${it.id}" data-d="-1" aria-label="Togli ${it.name}">−</button><output>${app.order[it.id] || 0}</output><button type="button" data-o="${it.id}" data-d="1" aria-label="Aggiungi ${it.name}">+</button></div></div>`).join('')}`).join('');
  $$('#opMenu [data-o]').forEach(x => x.addEventListener('click', () => { const id = x.dataset.o; app.order[id] = Math.max(0, Math.min(9, (app.order[id] || 0) + +x.dataset.d)); renderOrder(); }));
  const bar = `bar del blocco ${p.block}`;
  const modes = [
    { id: 'pickup', t: 'Ritiro express', s: `Al ${bar}, dalla corsia riservata agli ordini: niente coda alla cassa.` },
    { id: 'seat', t: 'Consegna al posto', s: premiumTier(p.tier) ? `Te lo portiamo in fila ${S.ROW[p.sel[0]]}, posto ${S.NUM[p.sel[0]]}.` : 'Disponibile in Tribuna e in Hospitality.', off: !premiumTier(p.tier) },
  ];
  $('#opMode').innerHTML = modes.map(m => `<button class="choice" type="button" role="radio" data-m="${m.id}" aria-checked="${app.mode === m.id}" ${m.off ? 'disabled' : ''}><span><b>${m.t}</b><small>${m.s}</small></span></button>`).join('');
  $$('#opMode [data-m]').forEach(x => x.addEventListener('click', () => { app.mode = x.dataset.m; renderOrder(); }));
  const whens = [{ id: 'pre', t: 'Prima del calcio d’inizio', s: `Pronto dalle ${MATCH.gatesOpen}` }, { id: 'ht', t: 'All’intervallo', s: 'Pronto al fischio di fine primo tempo' }];
  $('#opWhen').innerHTML = whens.map(m => `<button class="choice" type="button" role="radio" data-w="${m.id}" aria-checked="${app.when === m.id}"><span><b>${m.t}</b><small>${m.s}</small></span></button>`).join('');
  $$('#opWhen [data-w]').forEach(x => x.addEventListener('click', () => { app.when = x.dataset.w; renderOrder(); }));
  const t = allItems.reduce((a, it) => a + (app.order[it.id] || 0) * it.price, 0);
  $('#opTotal').textContent = eur(t); $('#opConfirm').disabled = t === 0;
}
$('#opConfirm').addEventListener('click', () => confirmOrder());
function confirmOrder() {
  const p = app.purchased, lines = allItems.filter(it => app.order[it.id]).map(it => ({ ...it, q: app.order[it.id] }));
  if (!lines.length) return;
  const t = lines.reduce((a, l) => a + l.q * l.price, 0); app.orderCode = 'R' + (2000 + (p.sel[0] % 7000));
  go('wallet');
  const where = app.mode === 'seat' ? `Consegna in fila ${S.ROW[p.sel[0]]}, posto ${S.NUM[p.sel[0]]}` : `Ritiro express al bar del blocco ${p.block}`;
  const when = app.when === 'pre' ? 'prima del calcio d’inizio' : 'all’intervallo';
  const ready = app.mode === 'seat' ? 'In consegna al tuo posto' : `Pronto al bar del blocco ${p.block}`;
  $('#wallet').innerHTML = `<div class="sheet"><span class="tag">Demo: ordine e pagamento simulati</span>
    <h2>Tutto pronto per la partita</h2>
    <p class="lead">Biglietti e ordine sono nello stesso posto. Allo stadio mostri il QR all’ingresso e, al bar, quello dell’ordine.</p>
    <div class="wgrid">
      <div class="card"><h3>Biglietti</h3><p class="meta">${MATCH.home}–${MATCH.away}, ${MATCH.dateShort}, ore ${MATCH.kickoff}</p>
        ${p.sel.map(i => `<div class="mini"><canvas class="qrmini" data-qr="${i}"></canvas><span><b>${p.sector.name}, blocco ${p.block}</b><small>Fila ${S.ROW[i]}, posto ${S.NUM[i]}. Titolare da indicare</small></span><span class="num">${S.NUM[i]}</span></div>`).join('')}
      </div>
      <div class="card"><h3>Ordine ${app.orderCode}</h3><p class="meta">${where}, ${when}</p>
        <ul class="olines">${lines.map(l => `<li><span>${l.q} × ${l.name}</span><span>${eur(l.q * l.price)}</span></li>`).join('')}<li><b>Totale</b><b>${eur(t)}</b></li></ul>
        <ol class="tl" id="tl"><li class="on"><b>Ricevuto</b>Il bar ha preso in carico l’ordine</li><li><b>In preparazione</b>Partirà in tempo per ${when}</li><li><b>${ready}</b>Ti avvisiamo con una notifica</li></ol>
      </div>
    </div>
    <div class="row"><button class="btn gold" id="wRestart" type="button">Ricomincia la demo</button><button class="btn link" id="wBack" type="button">Torna alla vista dal posto</button></div></div>`;
  paintQRs($('#wallet'));
  const tl = $$('#tl li'); setTimeout(() => tl[1]?.classList.add('on'), 1600); setTimeout(() => tl[2]?.classList.add('on'), 3600);
  $('#wRestart').addEventListener('click', restart); $('#wBack').addEventListener('click', () => go('seat'));
}

// ---------------- hospitality ----------------
function hospViewSeat() { const rows = hospBlock.rows, r = rows[7]; return r[Math.floor(r.length / 2)]; }
async function openHosp() {
  hideTip(); app.block = hospBlock.no; app.lastSeatHosp = true;
  Object.assign(st.state, { hover: null, focusSector: hospBlock.si, focusBlock: hospBlock.no, dimOthers: true }); st.state.sel.clear(); st.setPins([]); st.paint();
  go('hosp'); st.setRoof(0.1);
  $('#hpTitle').textContent = HOSPITALITY.name; $('#hpSub').textContent = HOSPITALITY.where + '. Esperienze premium con servizio dedicato.';
  renderHosp();
  st.setMode('fly'); await st.flyTo(st.views.block(hospBlock.no, drawerW(), sheetH(0.62)), 1.9, 20);
}
function renderHosp() {
  $('#hpList').innerHTML = HOSPITALITY.packages.map(p => `<button class="choice" type="button" role="radio" data-p="${p.id}" aria-checked="${app.hosp.pack === p.id}"><span><b>${p.name}</b><small>${p.desc}</small><em>Prezzo su richiesta, ${p.unit}</em></span></button>`).join('');
  $$('#hpList [data-p]').forEach(x => x.addEventListener('click', () => { app.hosp.pack = x.dataset.p; renderHosp(); }));
  $('#hqOut').textContent = app.hosp.people;
}
$$('[data-hq]').forEach(x => x.addEventListener('click', () => { app.hosp.people = Math.max(1, Math.min(12, app.hosp.people + +x.dataset.hq)); $('#hqOut').textContent = app.hosp.people; }));
$('#hpView').addEventListener('click', () => goSeat({ hosp: true }));
$('#hpReq').addEventListener('click', requestHosp);
function requestHosp() {
  const pack = HOSPITALITY.packages.find(p => p.id === app.hosp.pack);
  go('done');
  $('#done').innerHTML = `<div class="sheet"><span class="tag">Richiesta simulata</span><h2>Richiesta inviata</h2>
    <p class="lead">${pack.name} per ${app.hosp.people} ${app.hosp.people > 1 ? 'persone' : 'persona'}, ${MATCH.home}–${MATCH.away}. Il team hospitality del club ti ricontatta per confermare disponibilità e prezzo.</p>
    <div class="stack">${ticketHTML([hospViewSeat()], { hosp: true, people: app.hosp.people, totalV: null })}</div>
    <div class="row"><button class="btn gold" id="hRestart" type="button">Ricomincia la demo</button><button class="btn link" id="hBack" type="button">Torna alla pianta</button></div></div>`;
  paintQRs($('#done'));
  $('#hRestart').addEventListener('click', restart); $('#hBack').addEventListener('click', goPlan);
}

// ---------------- comandi generali ----------------
function restart() { app.sel = []; app.order = {}; app.purchased = null; app.block = null; goIntro(); }
$('#startBtn').addEventListener('click', goPlan);
$('#home').addEventListener('click', restart);
$('#introExplore').addEventListener('click',()=>go('visit'));
$$('[data-back]').forEach(x => x.addEventListener('click', () => app.view === 'order' ? go('done') : goPlan()));
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { ({ visit: goIntro, plan: goIntro, sector: goPlan, hosp: goPlan, seat: () => app.lastSeatHosp ? openHosp() : openBlock(app.block), order: () => go('done') })[app.view]?.(); }
});
window.addEventListener('resize', () => { if (app.view === 'sector') drawSeatMap(); });

// ---------------- presentazione automatica (?tour oppure tasto T) ----------------
const wait = ms => new Promise(r => setTimeout(r, ms));
let touring = false;
async function tour() {
  if (touring) return; touring = true;
  try {
    while (touring) {
      restart(); await wait(4500); if (!touring) break;
      await goPlan(); await wait(800);
      for (const si of [2, 3, 4]) { st.state.hover = { type: 'sector', si }; st.paint(); labelHot(si); await wait(1100); }
      st.state.hover = null; labelHot(null);
      app.qty = 2; await openBlock(19, { autoPickSeats: true }); renderSelection(); drawSeatMap(); await wait(2600);
      await goSeat(); await wait(4200); if (!touring) break;
      buy(); await wait(3000);
      openOrder(); await wait(900); app.order = { porchetta: 1, suppli: 1, birra: 2 }; renderOrder(); await wait(2200);
      confirmOrder(); await wait(5200); if (!touring) break;
      await openHosp(); await wait(2600);
      await goSeat({ hosp: true }); await wait(4200);
    }
  } finally { touring = false; }
}
window.addEventListener('keydown', e => { if (e.key === 't' || e.key === 'T') { touring ? (touring = false) : tour(); } });
window.addEventListener('pointerdown', e => { if (touring && e.isTrusted) touring = false; });

// avvio
requestAnimationFrame(() => requestAnimationFrame(() => { if(params.has('tour') || params.has('biglietteria'))go('intro');else go('visit'); if (params.has('tour')) setTimeout(tour, 600); }));

// Contesto 3D da Google Maps Platform: Photorealistic 3D Tiles (Map Tiles API) in streaming.
// Le tile vengono portate nel sistema locale della scena (metri, origine al centro del campo,
// X verso la Curva Nord, Y in alto, Z verso la Tribuna Tevere) e spianate sotto lo stadio
// ricostruito, così il modello si posa sul terreno reale senza sovrapporsi all'Olimpico fotografato.
import * as T from 'three';
import { TilesRenderer, WGS84_ELLIPSOID } from '3d-tiles-renderer/three';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/core/plugins';
import { GLTFExtensionsPlugin, UnloadTilesPlugin, TileFlatteningPlugin } from '3d-tiles-renderer/three/plugins';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { measuredRadius } from './environment.js';

const DEG = T.MathUtils.DEG2RAD;
const DRACO_DECODERS = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

export function googleKey(cfg) {
  const p = new URLSearchParams(location.search);
  if (p.has('osm')) return '';
  return (p.get('gkey') || cfg.apiKey || '').trim();
}

// Sagoma della facciata più un margine, in coordinate locali: area in cui le tile vengono spianate.
function footprint(margin, y) {
  const n = 128, pos = [0, y, 0], idx = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, r = measuredRadius(Math.cos(a), Math.sin(a)) * 1.03 + margin;
    pos.push(Math.cos(a) * r, y, Math.sin(a) * r); idx.push(0, 1 + i, 1 + (i + 1) % n);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const m = new T.Mesh(g, new T.MeshBasicMaterial({ side: T.DoubleSide })); m.matrixAutoUpdate = false;
  return m;
}

export function createGoogleContext({ scene, camera, renderer, cfg, key, low, dirty, fail }) {
  const state = { lat: cfg.lat, lon: cfg.lon, heading: cfg.heading, height: cfg.height };
  const tiles = new TilesRenderer();
  tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: key, autoRefreshToken: true, logoUrl: cfg.logoUrl || null }));
  tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: new DRACOLoader().setDecoderPath(DRACO_DECODERS) }));
  tiles.registerPlugin(new UnloadTilesPlugin());
  const flatten = new TileFlatteningPlugin(); tiles.registerPlugin(flatten);
  tiles.errorTarget = low ? 20 : 12;
  tiles.setCamera(camera); tiles.setResolutionFromRenderer(camera, renderer);
  tiles.group.name = 'Google Photorealistic 3D Tiles';
  tiles.group.matrixAutoUpdate = false;
  scene.add(tiles.group);
  document.body.classList.add('google-3d');

  // ---- posizionamento: ECEF -> sistema locale dello stadio ----
  const enu = new T.Matrix4(), toLocal = new T.Matrix4(), toEcef = new T.Matrix4(), axes = new T.Matrix4();
  const shape = footprint(cfg.flattenMargin, -0.25), downward = new T.Vector3();
  function place() {
    WGS84_ELLIPSOID.getEastNorthUpFrame(state.lat * DEG, state.lon * DEG, state.height, enu);
    const b = state.heading * DEG, s = Math.sin(b), c = Math.cos(b);
    // righe: assi locali X (Curva Nord), Y (alto), Z (Tribuna Tevere) espressi in Est-Nord-Alto
    axes.set(s, c, 0, 0,   0, 0, 1, 0,   c, -s, 0, 0,   0, 0, 0, 1);
    toLocal.copy(enu).invert().premultiply(axes);
    tiles.group.matrix.copy(toLocal); tiles.group.updateMatrixWorld(true);
    toEcef.copy(toLocal).invert();
    shape.matrix.copy(toEcef); shape.updateMatrixWorld(true);
    // il plugin proietta lungo questa direzione i vertici che stanno sopra la sagoma
    downward.set(0, -1, 0).transformDirection(toEcef);
    if (flatten.hasShape(shape)) flatten.deleteShape(shape);
    flatten.addShape(shape, downward, { threshold: Infinity });
    dirty();
  }
  place();

  // ---- materiali: le foto aeree hanno già la luce, niente illuminazione né ombre ----
  function prepare(model) {
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = false; o.receiveShadow = false;
      const m = o.material;
      if (!m) return;
      const basic = m.isMeshBasicMaterial ? m : new T.MeshBasicMaterial({ map: m.map || null, color: m.color ? m.color.clone() : new T.Color('#fff'),
        side: m.side, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, vertexColors: m.vertexColors });
      if (basic !== m) { o.material = basic; m.dispose(); }
      basic.color.multiplyScalar(cfg.brightness || 1);
    });
  }

  // ---- quota: misura il piazzale fuori dalla zona spianata e porta il suolo a y = 0 ----
  const ray = new T.Raycaster(), down = new T.Vector3(0, -1, 0), origin = new T.Vector3();
  function groundOffset() {
    const ys = [];
    for (let i = 0; i < 36; i++) {
      const a = i / 36 * Math.PI * 2, x = Math.cos(a), z = Math.sin(a);
      if (z < -0.3) continue; // a ovest sale il versante di Monte Mario
      const r = measuredRadius(x, z) * 1.03 + cfg.flattenMargin + 30; // fuori dalla fascia spianata
      ray.set(origin.set(x * r, 150, z * r), down); ray.far = 320;
      const hit = ray.intersectObject(tiles.group, true)[0];
      if (hit) ys.push(hit.point.y);
    }
    if (ys.length < 8) return null;
    ys.sort((p, q) => p - q);
    return ys[Math.floor(ys.length * 0.5)]; // mediana: scarta chiome, veicoli e bordi
  }
  let calibrations = cfg.autoHeight ? 0 : Infinity;
  function calibrate() {
    if (calibrations >= 8 || !loaded) return;
    const dy = groundOffset();
    if (dy === null) return;
    calibrations++;
    if (Math.abs(dy) < 0.15) { calibrations = Infinity; return; }
    state.height += dy; place(); syncPanel();
  }

  // ---- caricamento ed errori: senza risposta da Google si torna alla cartografia inclusa ----
  let loaded = false, failed = false;
  const giveUp = error => {
    if (loaded || failed) return;
    failed = true; console.warn('Contesto 3D Google non disponibile, uso la cartografia inclusa.', error);
    dispose(); fail(error);
  };
  tiles.addEventListener('load-model', e => { if (!loaded) clearTimeout(timer); loaded = true; prepare(e.scene); dirty(); });
  tiles.addEventListener('needs-render', dirty);
  tiles.addEventListener('load-error', e => giveUp(e.error));
  const timer = setTimeout(() => giveUp(new Error('Nessuna tile ricevuta entro 25 s')), 25000);

  // ---- attribuzioni obbligatorie: logo/testo Google Maps e fornitori dei dati ----
  const credit = document.createElement('small');
  credit.className = 'map-credit google-credit';
  document.body.append(credit);
  let lastCredit = null;
  function attributions() {
    const list = tiles.getAttributions();
    const data = list.filter(a => a.type === 'string').map(a => a.value).join(' ').trim();
    if (data === lastCredit) return;
    lastCredit = data;
    const brand = cfg.logoUrl ? Object.assign(new Image(), { src: cfg.logoUrl, alt: 'Google Maps', className: 'gm-logo' })
      : Object.assign(document.createElement('b'), { textContent: 'Google Maps' });
    const osm = Object.assign(document.createElement('a'), { href: 'https://www.openstreetmap.org/copyright', target: '_blank', rel: 'noopener', textContent: '© OpenStreetMap contributors' });
    credit.replaceChildren(brand, ` · Contesto 3D: ${data || 'Google'} · Stadio e copertura: modello ricostruito, sagoma `, osm);
  }

  // ---- ?calibra: pannello per rifinire posizione, azimut e quota ----
  let panel = null;
  function syncPanel() {
    if (!panel) return;
    panel.querySelector('[name=heading]').value = state.heading.toFixed(2);
    panel.querySelector('[name=height]').value = state.height.toFixed(2);
    panel.querySelector('output').value =
      `lat: ${state.lat.toFixed(7)},\nlon: ${state.lon.toFixed(7)},\nheading: ${state.heading.toFixed(2)},\nheight: ${state.height.toFixed(2)},`;
  }
  if (new URLSearchParams(location.search).has('calibra')) {
    panel = document.createElement('form');
    panel.className = 'gcalib';
    panel.innerHTML = `<b>Allineamento 3D Tiles</b>
      <label>Sposta a nord (m) <input name="north" type="number" step="0.5" value="0"></label>
      <label>Sposta a est (m) <input name="east" type="number" step="0.5" value="0"></label>
      <label>Azimut campo (°) <input name="heading" type="number" step="0.25"></label>
      <label>Quota ellissoidica (m) <input name="height" type="number" step="0.1"></label>
      <button type="submit">Applica</button><small>Copia in GOOGLE_3D (config.js):</small><output></output>`;
    panel.addEventListener('submit', ev => {
      ev.preventDefault();
      const f = new FormData(panel), north = +f.get('north') || 0, east = +f.get('east') || 0;
      state.lat += north / 111132; state.lon += east / (111320 * Math.cos(state.lat * DEG));
      state.heading = +f.get('heading'); state.height = +f.get('height');
      panel.querySelector('[name=north]').value = 0; panel.querySelector('[name=east]').value = 0;
      calibrations = Infinity; place(); syncPanel();
    });
    document.body.append(panel); syncPanel();
    window.__google3d = { tiles, state, place, groundOffset }; // ispezione dalla console durante la calibrazione
  }

  let frame = 0;
  function update() {
    camera.updateMatrixWorld();
    tiles.setResolutionFromRenderer(camera, renderer);
    tiles.update();
    if (++frame % 30 === 0) attributions();
    if (frame % 90 === 0) calibrate();
  }
  function dispose() {
    clearTimeout(timer);
    scene.remove(tiles.group); tiles.dispose();
    credit.remove(); panel?.remove();
    document.body.classList.remove('google-3d');
  }
  return { tiles, update, dispose, state };
}

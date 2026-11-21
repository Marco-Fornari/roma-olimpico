// Dati della demo. Tutto quello che si vede nella pagina parte da qui.
// Prezzi, numerazione dei blocchi e disponibilità sono INDICATIVI:
// nel prodotto reale arrivano dal sistema di biglietteria del club.

export const MATCH = {
  home: 'Roma',
  away: 'Juventus',
  competition: 'Serie A',
  round: '16ª giornata',
  dateLong: 'Domenica 20 dicembre 2026',
  dateShort: '20 dicembre',
  kickoff: '20:45',
  gatesOpen: '18:45',
  venue: 'Stadio Olimpico',
  note: 'Data e orario indicativi',
};

// riduzioni: moltiplicatore sul prezzo intero
export const TARIFFS = [
  { id: 'full', label: 'Intero', k: 1 },
  { id: 'u16', label: 'Under 16', k: 0.5 },
  { id: 'o65', label: 'Over 65', k: 0.7 },
];

// fasce, nell'ordine dell'upgrade (come Economy > Premium > First > Residence)
export const TIERS = {
  E: { name: 'Curve', next: 'P' },
  P: { name: 'Distinti', next: 'F' },
  F: { name: 'Tribune', next: 'R' },
  R: { name: 'Hospitality', next: null },
};

// Settori in senso orario visto dall'alto, partendo dalla Tribuna Monte Mario.
// u = posizione lungo l'anello (0-4): 0-1 lato Monte Mario, 1-2 curva sud, 2-3 lato Tevere, 3-4 curva nord.
// occ = riempimento previsto per questa partita (0-1)
export const SECTORS = [
  { id: 'MM', name: 'Tribuna Monte Mario', short: 'Monte Mario', u: [-0.12, 1.12], blocks: [8, 9, 10, 11, 12, 13, 14], tier: 'F', occ: 0.72, gate: 'Ingresso Monte Mario' },
  { id: 'DSO', name: 'Distinti Sud Ovest', short: 'Distinti Sud Ovest', u: [1.12, 1.33], blocks: [15, 16, 17], tier: 'P', occ: 0.84, price: 55, gate: 'Ingresso Distinti Sud' },
  { id: 'CS', name: 'Curva Sud', short: 'Curva Sud', u: [1.33, 1.67], blocks: [18, 19, 20, 21], tier: 'E', occ: 0.94, price: 45, noReductions: true, gate: 'Ingresso Curva Sud' },
  { id: 'DSE', name: 'Distinti Sud Est', short: 'Distinti Sud Est', u: [1.67, 1.88], blocks: [22, 23, 24], tier: 'P', occ: 0.86, price: 55, gate: 'Ingresso Distinti Sud' },
  { id: 'TT', name: 'Tribuna Tevere', short: 'Tevere', u: [1.88, 3.12], blocks: [25, 26, 27, 28, 29, 30, 31], tier: 'F', occ: 0.74, gate: 'Ingresso Tevere' },
  { id: 'DNE', name: 'Distinti Nord Est', short: 'Distinti Nord Est', u: [3.12, 3.33], blocks: [32, 33, 34], tier: 'P', occ: 0.62, price: 35, gate: 'Ingresso Distinti Nord' },
  { id: 'CN', name: 'Curva Nord', short: 'Curva Nord', u: [3.33, 3.67], blocks: [35, 36, 37, 38], tier: 'E', occ: 0.66, price: 28, gate: 'Ingresso Curva Nord' },
  { id: 'DNO', name: 'Distinti Nord Ovest', short: 'Settore ospiti', u: [3.67, 3.88], blocks: [39, 40, 41], tier: 'X', occ: 0.8, away: true, gate: 'Ingresso ospiti' },
];

// prezzi per blocco dove variano dentro il settore (Tribune)
export const BLOCK_PRICE = {
  8: 85, 9: 85, 10: 100, 12: 100, 13: 85, 14: 85,
  25: 85, 26: 85, 27: 95, 28: 95, 29: 95, 30: 75, 31: 75,
};

// Tribuna d'Onore: centro della Monte Mario
export const HOSP_BLOCKS = [11];
export const HOSPITALITY = {
  name: "Tribuna d'Onore",
  where: 'Monte Mario centrale, blocco 11',
  packages: [
    { id: 'onore', name: "Posto in Tribuna d'Onore", desc: 'Posto riservato al centro della Monte Mario, ingresso dedicato, buffet prima della partita e all’intervallo.', unit: 'a persona' },
    { id: 'box', name: 'Executive Box', desc: 'Box privato per aziende e gruppi, accoglienza con personale dedicato, servizio al tavolo per tutta la serata.', unit: 'per box' },
  ],
};

// upgrade proposto dal biglietto di ogni fascia: blocco suggerito
export const UPSELL = { E: 23, P: 28, F: 11 };

export const MENU = [
  {
    cat: 'Da mangiare', items: [
      { id: 'porchetta', name: 'Panino con porchetta', desc: 'Porchetta di Ariccia, pane casereccio', price: 8 },
      { id: 'suppli', name: 'Supplì', desc: 'Due pezzi, fritti al momento', price: 5 },
      { id: 'pizza', name: 'Pizza bianca e mortadella', desc: 'Farcita al banco', price: 6.5 },
      { id: 'maritozzo', name: 'Maritozzo con la panna', desc: 'Perfetto per l’intervallo', price: 4 },
    ],
  },
  {
    cat: 'Da bere', items: [
      { id: 'acqua', name: 'Acqua naturale', desc: '50 cl', price: 2.5 },
      { id: 'bibita', name: 'Bibita', desc: 'Lattina 33 cl', price: 3.5 },
      { id: 'birra', name: 'Birra analcolica', desc: 'Alla spina, 40 cl', price: 6 },
      { id: 'caffe', name: 'Caffè', desc: 'Espresso', price: 1.5 },
    ],
  },
];

export const AUTHOR = 'Marco Fornari';

// Contesto 3D da Google Maps Platform (Photorealistic 3D Tiles, Map Tiles API).
// Con una chiave il quartiere, il Foro Italico e Monte Mario arrivano in streaming da Google
// e lo stadio ricostruito ci viene posato sopra. Senza chiave, o se Google non risponde,
// la scena usa la cartografia OpenStreetMap inclusa nel file e funziona anche offline.
// La chiave si può anche passare nell'URL: ?gkey=LA_TUA_CHIAVE. ?osm forza la cartografia inclusa,
// ?calibra apre il pannello per rifinire l'allineamento.
export const GOOGLE_3D = {
  apiKey: '',           // chiave Google Cloud con "Map Tiles API" attiva
  lat: 41.933886,       // centro del campo, gradi WGS84
  lon: 12.454786,
  heading: -16.5,       // azimut dell'asse del campo verso la Curva Nord, gradi da nord in senso orario
  height: 68,           // quota ellissoidica di partenza del terreno di gioco, metri
  autoHeight: true,     // misura il piazzale attorno allo stadio e corregge la quota da sola
  flattenMargin: 10,    // metri oltre la facciata in cui le tile vengono spianate sotto il modello
  brightness: 1.12,     // compensazione della resa delle foto aeree con il tone mapping della scena
  logoUrl: '',          // logo ufficiale Google Maps (asset scaricabile dalle policy Map Tiles API); senza, testo "Google Maps"
};

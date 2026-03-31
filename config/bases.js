// ══════════════════════════════════════════════════════
//  SITIOS HIDALGO GPS — Bases de operación
//  Nochixtlán, Oaxaca
// ══════════════════════════════════════════════════════

export const BASES = [
  { id: "B1", nombre: "Base Central",       lat: 17.4572, lng: -97.2311, radio: 150 },
  { id: "B2", nombre: "Mercado Municipal",  lat: 17.4558, lng: -97.2287, radio: 120 },
  { id: "B3", nombre: "Presidencia",        lat: 17.4580, lng: -97.2295, radio: 100 },
  { id: "B4", nombre: "IMSS / Hospital",    lat: 17.4540, lng: -97.2340, radio: 130 },
  { id: "B5", nombre: "Central Autobuses",  lat: 17.4510, lng: -97.2270, radio: 120 },
  { id: "B6", nombre: "Col. Reforma",       lat: 17.4600, lng: -97.2260, radio: 110 },
  { id: "B7", nombre: "Libramiento Norte",  lat: 17.4630, lng: -97.2330, radio: 140 }
];

// Centro geográfico de Nochixtlán (vista inicial del mapa)
export const CENTRO = { lat: 17.4572, lng: -97.2311, zoom: 15 };

// Radio máximo para considerar un taxi "cerca" (metros)
export const RADIO_CERCA = 500;

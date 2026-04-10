// ══════════════════════════════════════════════════════
//  SITIOS HIDALGO GPS — Bases de operación
//  Nochixtlán, Oaxaca
//  Coordenadas calibradas en campo con SW Maps — precisión 1.4m a 3m
//  Fuente canónica: base/geocercas.js y base-gps/index.html
// ══════════════════════════════════════════════════════

export const BASES = [
  { id: "B1", nombre: "Centro Nochixtlán",        lat: 17.459468, lng: -97.225268, radio: 80  },
  { id: "B2", nombre: "Zona Turística",            lat: 17.460197, lng: -97.229843, radio: 80  },
  { id: "B3", nombre: "Terminal Sur",              lat: 17.460377, lng: -97.231048, radio: 100 },
  { id: "B4", nombre: "Porfirio Díaz / Alcalá",   lat: 17.458817, lng: -97.222210, radio: 80  },
  { id: "B5", nombre: "Porfirio Díaz / 5 de Feb", lat: 17.459680, lng: -97.227145, radio: 80  },
  { id: "B6", nombre: "Hospital",                  lat: 17.450427, lng: -97.225592, radio: 100 },
  { id: "B7", nombre: "Fresno",                    lat: 17.453626, lng: -97.230098, radio: 80  },
];

// Centro del mapa — coincide con MAP_CENTER en base-gps/index.html
export const CENTRO = { lat: 17.4575, lng: -97.2273, zoom: 15 };

// Radio máximo para considerar un taxi "cerca" (metros)
export const RADIO_CERCA = 500;

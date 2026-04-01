// GEOCERCAS — SITIOS HIDALGO A.C.
// Generado: 21/03/2026
// Calibradas en campo con SW Maps — precisión 1.4m a 3m
// 7/7 bases confirmadas

const BASES = [
  { id:'B1', nombre:'Centro',                   lat:17.459468, lng:-97.225268, radio:80,  color:'#f0a500' },
  { id:'B2', nombre:'Turístico',                lat:17.460197, lng:-97.229843, radio:80,  color:'#1de98b' },
  { id:'B3', nombre:'Terminal Sur',             lat:17.460377, lng:-97.231048, radio:100, color:'#4fc3f7' },
  { id:'B4', nombre:'Porfirio Díaz / Alcalá',   lat:17.458817, lng:-97.222210, radio:80,  color:'#ff6b81' },
  { id:'B5', nombre:'Porfirio Díaz / 5 de Feb', lat:17.459680, lng:-97.227145, radio:80,  color:'#a29bfe' },
  { id:'B6', nombre:'Hospital',                 lat:17.450427, lng:-97.225592, radio:100, color:'#fd9644' },
  { id:'B7', nombre:'Fresno',                   lat:17.453626, lng:-97.230098, radio:80,  color:'#69F0AE' },
];

// Distancia en metros entre dos coordenadas
function calcDistM(lat1, lng1, lat2, lng2) {
  return Math.hypot(lat1 - lat2, lng1 - lng2) * 111319;
}

// Base más cercana a una posición
function getBaseCercana(lat, lng) {
  let closest = null, minDist = Infinity;
  BASES.forEach(b => {
    const d = calcDistM(lat, lng, b.lat, b.lng);
    if (d < minDist) { minDist = d; closest = b; }
  });
  return { base: closest, distM: Math.round(minDist) };
}

// ¿Está dentro de la geocerca de una base?
function enGeocerca(lat, lng, base) {
  return calcDistM(lat, lng, base.lat, base.lng) <= base.radio;
}

// Base en la que está una unidad (null si no está en ninguna)
function getBaseDeUnidad(lat, lng) {
  for (const b of BASES) {
    if (enGeocerca(lat, lng, b)) return b;
  }
  return null;
}

// SITIOS HIDALGO GPS - Compartir Viaje
let _viajeActivo=null,_shareInterval=null;
export function iniciarCompartirViaje(){_viajeActivo=window.activeViaje||null;}
export function detenerCompartirViaje(){if(_shareInterval){clearInterval(_shareInterval);_shareInterval=null;}_viajeActivo=null;}
export async function compartirViaje(){const v=_viajeActivo||window.activeViaje;if(!v)return;const t=_txt(v);if(navigator.share){try{await navigator.share({title:"SHidalgo",text:t});return;}catch(e){}}await copiarAlPortapapeles(t);}
export function compartirPorWhatsApp(){const v=_viajeActivo||window.activeViaje;if(!v)return;window.open("https://wa.me/?text="+encodeURIComponent(_txt(v)),"_blank");}
export async function copiarAlPortapapeles(texto){const t=texto||_txt({});try{await navigator.clipboard.writeText(t);if(window.showToast)window.showToast("Copiado");}catch(e){}}
function _txt(v){return "SHidalgo - Unidad: "+((v&&v.unitId)||"-")+" Conductor: "+((v&&v.conductor)||"N/A")+" Destino: "+((v&&v.destino)||"-");}

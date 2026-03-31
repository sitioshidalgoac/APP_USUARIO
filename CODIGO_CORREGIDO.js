// ═══════════════════════════════════════════════════════════════════════════
// 📱 APP CONDUCTOR — CÓDIGO CORREGIDO
// Cambios: Estados en MAYÚSCULAS (LIBRE, OCUPADO, DESCANSO, OFFLINE, SOS)
// ═══════════════════════════════════════════════════════════════════════════

// ─── PARTE 1: INICIALIZACIÓN ───────────────────────────────────────────────
// Cambio: 'libre' → 'LIBRE'
let db = null;
let driverUnit = '', driverName = '', myStatus = 'LIBRE';
let lat = null, lng = null, spd = 0, acc = 0;


// ─── PARTE 2: BOTONES DE ESTADO HTML ───────────────────────────────────────
// Cambio: data-st y onclick usan MAYÚSCULAS
          <button class="st-btn libre on" data-st="LIBRE" onclick="setStatus('LIBRE')">🟢 LIBRE</button>
          <button class="st-btn ocupado" data-st="OCUPADO" onclick="setStatus('OCUPADO')">🟠 OCUPADO</button>
          <button class="st-btn descanso" data-st="DESCANSO" onclick="setStatus('DESCANSO')">🔵 DESCANSO</button>


// ─── PARTE 3: LOGOUT ──────────────────────────────────────────────────────
// Cambio: 'offline' → 'OFFLINE'
function doLogout() {
  if (!confirm('¿Terminar turno?')) return;
  if (db && driverUnit) {
    db.ref('unidades/' + driverUnit).update({ status:'OFFLINE', online:false, speed:0 });
  }
  if (watchId) navigator.geolocation.clearWatch(watchId);
  if (sendInt) clearInterval(sendInt);
  firebase.auth().signOut();
  document.getElementById('scr-main').classList.remove('active');
  document.getElementById('scr-login').classList.add('active');
  // Limpiar campos
  document.getElementById('l-unit').value = '';
  document.getElementById('l-name').value = '';
  document.getElementById('l-pass').value = '';
  driverUnit = ''; driverName = ''; lat = null; lng = null;
}


// ─── PARTE 4: CAMBIAR ESTADO ───────────────────────────────────────────────
// Cambio: 'ocupado' → 'OCUPADO' (dos lugares)
function setStatus(s) {
  const prev = myStatus;

  if (s === 'OCUPADO' && prev !== 'OCUPADO') {
    viajeActivo = { startTime: Date.now(), startLat: lat, startLng: lng };
  }
  if (prev === 'OCUPADO' && s !== 'OCUPADO' && viajeActivo) {
    const dur  = Math.round((Date.now() - viajeActivo.startTime) / 60000);
    const dist = calcDist(viajeActivo.startLat, viajeActivo.startLng, lat, lng);
    const v = {
      id: historial.length + 1,
      fecha:    new Date(viajeActivo.startTime).toLocaleDateString('es-MX'),
      horaIni:  new Date(viajeActivo.startTime).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}),
      horaFin:  new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}),
      duracion: dur, distancia: dist.toFixed(1)
    };
    historial.unshift(v);
    tripViajes++;
    totalKm += parseFloat(dist);
    document.getElementById('pf-viajes').textContent = tripViajes;
    document.getElementById('pf-km').textContent     = totalKm.toFixed(1);
    renderHistorial();
    if (db) db.ref('historial/' + driverUnit + '/' + v.id).set(v);
    viajeActivo = null;
  }

  myStatus = s;
  document.getElementById('gc-st').textContent = s;
  document.querySelectorAll('.st-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.st === s);
  });
  if (db && driverUnit) db.ref('unidades/' + driverUnit + '/status').set(s);
}


// ─── PARTE 5: SOS ─────────────────────────────────────────────────────────
// Cambio: 'sos' → 'SOS' (dos lugares)
function confirmSOS() {
  closeSOS();
  myStatus = 'SOS';
  document.getElementById('sos-activo').style.display = 'flex';
  if (db && driverUnit) {
    db.ref('unidades/' + driverUnit + '/status').set('SOS');
    db.ref('alertas_sos/' + driverUnit).set({
      unit: driverUnit, name: driverName,
      lat: lat||0, lng: lng||0,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });
  }
  toast('🚨 SOS enviado — Base Central notificada', 'danger');
}

function listenSOSReset() {
  if (!db || !driverUnit) return;
  db.ref('unidades/' + driverUnit + '/status').on('value', snap => {
    const s = snap.val();
    if (s && s !== 'SOS' && myStatus === 'SOS') {
      myStatus = s;
      document.getElementById('sos-activo').style.display = 'none';
      document.querySelectorAll('.st-btn').forEach(b => b.classList.toggle('on', b.dataset.st === s));
      toast('✅ SOS desactivado por Base Central', 'ok');
    }
  });
}


// ═══════════════════════════════════════════════════════════════════════════
// 📱 APP USUARIO — CÓDIGO CORREGIDO
// Agregados: Logs detallados de debugging
// ═══════════════════════════════════════════════════════════════════════════

function _initFirebase() {
  if (fbRef) off(fbRef);   // limpiar listener anterior
  fbRef = ref(db, "unidades");

  onValue(fbRef, snap => {
    const d = snap.val() || {};
    unidades = {};
    Object.entries(d).forEach(([id, u]) => { unidades[id] = { ...u, id }; });

    // ⭐ NUEVO: Logs de rastreo
    console.log("🚖 Conductores recibidos desde Firebase:", unidades);
    console.log("🔍 Total de unidades:", Object.keys(unidades).length);
    
    const lib = Object.values(unidades).filter(u => u.status === "LIBRE" && u.online !== false);
    const ocp = Object.values(unidades).filter(u => u.status === "OCUPADO");
    
    console.log("✅ Taxis LIBRES:", lib.length, lib);
    console.log("🔴 Taxis OCUPADOS:", ocp.length);

    document.getElementById("cnt-libres").textContent   = lib.length;
    document.getElementById("cnt-ocupados").textContent = ocp.length;
    document.getElementById("btn-solicitar").disabled   = lib.length === 0;

    _updCerca();
    actualizarMarcadores(unidades);
  });
}


function _updCerca() {
  const c = Object.values(unidades)
    .filter(u => u.status === "LIBRE" && u.lat && u.lng &&
                 dist(myLat, myLng, u.lat, u.lng) < RADIO_CERCA)
    .length;
  // ⭐ NUEVO: Log de taxis cercanos
  console.log("📍 Taxis cercanos (radio " + RADIO_CERCA + "m):", c);
  document.getElementById("cnt-cerca").textContent = c;
}


window.solicitarTaxi = function() {
  const dest   = document.getElementById("sol-destino").value.trim();
  const refTxt = document.getElementById("sol-ref").value.trim();

  if (!dest) { showToast("📍 Escribe tu destino"); return; }

  const libres = Object.values(unidades)
    .filter(u => u.status === "LIBRE" && u.online !== false && u.lat && u.lng);

  // ⭐ NUEVO: Logs detallados de búsqueda
  console.log("🔎 Buscando taxis LIBRES...");
  console.log("   Criterios: status='LIBRE', online=true, lat y lng válidos");
  console.log("   Taxis LIBRES encontrados:", libres.length);
  console.log("   Detalles:", libres);

  if (!libres.length) { 
    console.warn("⚠️ No hay taxis disponibles - mostrando mensaje al usuario");
    showToast("😔 No hay taxis disponibles ahora"); 
    return; 
  }

  // Taxi más cercano al usuario
  const cerca = libres.reduce((mejor, u) =>
    dist(myLat, myLng, u.lat, u.lng) < dist(myLat, myLng, mejor.lat, mejor.lng) ? u : mejor
  );

  const destFull = dest + (refTxt ? ` (${refTxt})` : "");

  try {
    push(ref(db, "solicitudes_clientes"), {
      cliente:    myName,
      telefono:   myPhone,
      destino:    dest,
      referencia: refTxt,
      unitId:     cerca.id,
      lat:        myLat,
      lng:        myLng,
      ts:         Date.now(),
      estado:     "ENVIADA"
    });
    set(ref(db, `unidades/${cerca.id}/viaje`), {
      destino:  destFull,
      cliente:  myName,
      telefono: myPhone,
      estado:   "PENDIENTE",
      ts:       Date.now()
    });
  } catch {
    showToast("⚠️ Error de conexión. Intenta de nuevo."); return;
  }

  activeViaje = { unitId: cerca.id, destino: dest, conductor: cerca.conductor };
  historial.push({ destino: dest, conductor: cerca.conductor, unitId: cerca.id, ts: Date.now() });
  guardarHistorial(historial);

  cerrarModal();
  document.getElementById("v-taxi-id").textContent   = cerca.id;
  document.getElementById("v-taxi-cond").textContent = cerca.conductor || "Conductor";
  document.getElementById("v-destino").textContent   = dest;
  document.getElementById("viaje-ov").classList.add("show");

  const metros = Math.round(dist(myLat, myLng, cerca.lat, cerca.lng));
  showToast(`✅ Taxi ${cerca.id} asignado — ${metros}m aprox.`);

  // Rating automático después de 30 segundos
  setTimeout(() => { if (activeViaje) _mostrarRating(); }, 30000);
};


// ═══════════════════════════════════════════════════════════════════════════
// 🗺️ MAPA — CÓDIGO CORREGIDO
// Agregados: Logs de actualización de marcadores
// ═══════════════════════════════════════════════════════════════════════════

export function actualizarMarcadores(unidades) {
  if (!map) return;

  // ⭐ NUEVO: Log general
  console.log("🗺️  Actualizando marcadores en mapa. Total unidades:", Object.keys(unidades).length);

  // Eliminar marcadores de unidades que ya no existen en Firebase
  Object.keys(mks).forEach(id => {
    if (!unidades[id]) {
      map.removeLayer(mks[id]);
      delete mks[id];
      console.log("  ❌ Marcador removido:", id);
    }
  });

  // Crear o actualizar marcadores
  Object.entries(unidades).forEach(([id, u]) => {
    if (!u.lat || !u.lng) {
      console.log("  ⚠️  Unidad", id, "sin coordenadas válidas");
      return;
    }

    const libre = u.status === "LIBRE" && u.online !== false;
    const sz    = libre ? 28 : 20;
    const color = libre ? "#16a34a" : "#9ca3af";
    const op    = u.online !== false ? 1 : 0.4;

    // ⭐ NUEVO: Log de unidades LIBRES
    if (libre) {
      console.log(`  ✅ Unidad ${id} LIBRE en mapa - Lat: ${u.lat}, Lng: ${u.lng}`);
    }

    const ic = L.divIcon({
      html: `<div style="background:${color};width:${sz}px;height:${sz}px;
             border-radius:50%;display:flex;align-items:center;justify-content:center;
             font-size:${libre?13:10}px;border:2px solid #fff;
             box-shadow:0 2px 8px rgba(0,0,0,0.18);opacity:${op}">🚖</div>`,
      className:  "",
      iconSize:   [sz, sz],
      iconAnchor: [sz/2, sz/2]
    });

    if (mks[id]) {
      mks[id].setLatLng([u.lat, u.lng]).setIcon(ic);
    } else {
      mks[id] = L.marker([u.lat, u.lng], { icon: ic })
        .addTo(map)
        .bindPopup(`<b>${id}</b><br>${u.conductor || ""}<br><b>${u.status}</b>`);
    }
  });
}

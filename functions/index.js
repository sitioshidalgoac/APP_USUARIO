"use strict";

// ╔══════════════════════════════════════════════════════════════════════╗
// ║   SITIOS HIDALGO A.C. DE NOCHIXTLÁN — CLOUD FUNCTIONS v2.0         ║
// ║   Firebase Functions v4 · Node 18 · Realtime Database               ║
// ║                                                                      ║
// ║   FUNCIONES:                                                         ║
// ║   ① verificarInactividad   — archiva unidades sin señal +48h        ║
// ║   ② limpiarDatos           — purga mensajes, logs y SOS viejos      ║
// ║   ③ alertaSOS              — notifica SOS en tiempo real             ║
// ║   ④ reporteDiario          — resumen de flotilla cada mañana         ║
// ║   ⑤ registrarHistorial     — auditoría de cada cambio de estado      ║
// ║   ⑥ monitorConexion        — detecta conductores que se desconectan  ║
// ║   ⑦ estadisticasHora       — snapshot horario de la flotilla         ║
// ╚══════════════════════════════════════════════════════════════════════╝

const functions = require("firebase-functions");
const admin     = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const db = admin.database();

// ─────────────────────────────────────────────
// CONFIGURACIÓN CENTRAL
// Cambiar aquí afecta todo el sistema
// ─────────────────────────────────────────────
const CONFIG = {
  timezone:           "America/Mexico_City",
  limiteInactividad:  48 * 60 * 60 * 1000,   // 48h → archivar unidad
  limiteOffline:       2 * 60 * 60 * 1000,   //  2h → marcar como offline
  limiteMensajes:      7 * 24 * 60 * 60 * 1000, // 7 días → borrar mensajes
  limiteLogEventos:   30 * 24 * 60 * 60 * 1000, // 30 días → borrar logs
  limiteSosResueltos: 14 * 24 * 60 * 60 * 1000, // 14 días → borrar SOS
  maxMensajesRadio:   500,  // máximo mensajes en /mensajes/
  sistema:            "SITIOS HIDALGO A.C. DE NOCHIXTLÁN",
};

// ─────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────

/** Formatea ms a "Xh Ym" */
function formatDuracion(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Fecha legible CDMX */
function fechaMX(ts = Date.now()) {
  return new Date(ts).toLocaleString("es-MX", { timeZone: CONFIG.timezone });
}

/** Escribe un evento en /log_eventos/ */
async function logEvento(tipo, datos) {
  return db.ref("log_eventos").push({
    tipo,
    ...datos,
    sistema:   CONFIG.sistema,
    timestamp: Date.now(),
    fechaMX:   fechaMX(),
  });
}

/** Ejecuta array de promesas en lotes para no saturar Firebase */
async function ejecutarEnLotes(promesas, tamLote = 10) {
  for (let i = 0; i < promesas.length; i += tamLote) {
    await Promise.all(promesas.slice(i, i + tamLote));
  }
}


// ════════════════════════════════════════════════════════════
// ① VERIFICAR INACTIVIDAD
//    Cada hora revisa todas las unidades.
//    - +2h sin señal  → status = "offline"
//    - +48h sin señal → archiva en /unidades_inactivas/ y elimina
// ════════════════════════════════════════════════════════════
exports.verificarInactividad = functions
  .runWith({ timeoutSeconds: 120, memory: "256MB" })
  .pubsub.schedule("every 60 minutes")
  .timeZone(CONFIG.timezone)
  .onRun(async () => {
    const ahora    = Date.now();
    const snapshot = await db.ref("unidades").once("value");

    if (!snapshot.exists()) {
      console.log("[inactividad] Sin unidades registradas.");
      return null;
    }

    const aArchivar = [];
    const aOffline  = [];

    snapshot.forEach(child => {
      const data    = child.val();
      const ultimaCx = data.timestamp || data.ultimaConexion || 0;
      const elapsed  = ahora - ultimaCx;

      if (elapsed > CONFIG.limiteInactividad) {
        aArchivar.push({ key: child.key, data, elapsed });
      } else if (elapsed > CONFIG.limiteOffline && data.status !== "offline") {
        aOffline.push({ key: child.key, data, elapsed });
      }
    });

    // Marcar offline
    const promesasOffline = aOffline.map(({ key, elapsed }) => {
      console.log(`[inactividad] ${key} → offline (${formatDuracion(elapsed)} sin señal)`);
      return db.ref(`unidades/${key}/status`).set("offline");
    });

    // Archivar y eliminar
    const promesasArchivar = aArchivar.map(({ key, data, elapsed }) => {
      const horas = Math.floor(elapsed / 3600000);
      console.log(`[inactividad] ${key} → ARCHIVANDO (${horas}h sin señal)`);

      return db.ref(`unidades_inactivas/${key}`).set({
        ...data,
        status:              "inactiva",
        motivo:              `Inactividad automática — ${horas}h sin señal GPS`,
        fechaDesactivacion:  ahora,
        fechaDesactivacionMX: fechaMX(ahora),
        horasInactiva:       horas,
      })
      .then(() => db.ref(`unidades/${key}`).remove())
      .then(() => logEvento("DESACTIVACION_AUTO", {
        unidad:  key,
        nombre:  data.name || "—",
        horas,
        lat:     data.lat || null,
        lng:     data.lng || null,
      }));
    });

    await ejecutarEnLotes([...promesasOffline, ...promesasArchivar]);

    console.log(`[inactividad] ✅ ${aOffline.length} offline, ${aArchivar.length} archivadas.`);
    return null;
  });


// ════════════════════════════════════════════════════════════
// ② LIMPIAR DATOS
//    Cada día a las 2am limpia datos históricos viejos:
//    mensajes de radio, logs de eventos y SOS resueltos
// ════════════════════════════════════════════════════════════
exports.limpiarDatos = functions
  .runWith({ timeoutSeconds: 180, memory: "256MB" })
  .pubsub.schedule("0 2 * * *")
  .timeZone(CONFIG.timezone)
  .onRun(async () => {
    const ahora = Date.now();
    let totalBorrados = 0;

    // Helper: borrar nodos anteriores a cierta fecha
    async function purgarNodo(ruta, limite) {
      const snap = await db.ref(ruta)
        .orderByChild("timestamp")
        .endAt(ahora - limite)
        .once("value");
      if (!snap.exists()) return 0;
      const p = [];
      snap.forEach(c => p.push(db.ref(`${ruta}/${c.key}`).remove()));
      await ejecutarEnLotes(p);
      return p.length;
    }

    // Limpiar mensajes de radio (+7 días)
    const msgBorrados = await purgarNodo("mensajes", CONFIG.limiteMensajes);
    console.log(`[limpieza] Mensajes: ${msgBorrados} eliminados`);

    // Limpiar log de eventos (+30 días)
    const logBorrados = await purgarNodo("log_eventos", CONFIG.limiteLogEventos);
    console.log(`[limpieza] Log eventos: ${logBorrados} eliminados`);

    // Limpiar SOS resueltos (+14 días)
    const sosSnap = await db.ref("alertas_sos")
      .orderByChild("timestamp")
      .endAt(ahora - CONFIG.limiteSosResueltos)
      .once("value");

    const sosBorrar = [];
    if (sosSnap.exists()) {
      sosSnap.forEach(c => {
        if (c.val().resuelta) sosBorrar.push(db.ref(`alertas_sos/${c.key}`).remove());
      });
      await ejecutarEnLotes(sosBorrar);
    }
    console.log(`[limpieza] SOS resueltos: ${sosBorrar.length} eliminados`);

    // Limitar mensajes de radio a MAX_MENSAJES más recientes
    const todosMsg = await db.ref("mensajes").orderByChild("timestamp").once("value");
    if (todosMsg.numChildren() > CONFIG.maxMensajesRadio) {
      const exceso = todosMsg.numChildren() - CONFIG.maxMensajesRadio;
      const pExceso = [];
      let cont = 0;
      todosMsg.forEach(c => { if (cont++ < exceso) pExceso.push(db.ref(`mensajes/${c.key}`).remove()); });
      await ejecutarEnLotes(pExceso);
      console.log(`[limpieza] Exceso mensajes: ${pExceso.length} eliminados`);
      totalBorrados += pExceso.length;
    }

    totalBorrados += msgBorrados + logBorrados + sosBorrar.length;

    await logEvento("LIMPIEZA_DIARIA", {
      mensajesBorrados:  msgBorrados,
      logsBorrados:      logBorrados,
      sosBorrados:       sosBorrar.length,
      totalBorrados,
    });

    console.log(`[limpieza] ✅ Total: ${totalBorrados} registros eliminados.`);
    return null;
  });


// ════════════════════════════════════════════════════════════
// ③ ALERTA SOS — TIEMPO REAL
//    Se dispara en microsegundos cuando status → "sos"
//    Registra en /alertas_sos/ y notifica en canal de radio
// ════════════════════════════════════════════════════════════
exports.alertaSOS = functions
  .database.ref("unidades/{unitId}/status")
  .onWrite(async (change, context) => {
    const antes  = change.before.val();
    const ahora  = change.after.val();
    const unitId = context.params.unitId;

    // Solo al ENTRAR en SOS
    if (ahora !== "sos" || antes === "sos") return null;

    const unitSnap = await db.ref(`unidades/${unitId}`).once("value");
    const unit     = unitSnap.val() || {};
    const ts       = Date.now();

    // Registrar alerta completa
    const alertaRef = await db.ref("alertas_sos").push({
      unidad:      unitId,
      nombre:      unit.name   || unit.nombre || "Desconocido",
      telefono:    unit.phone  || null,
      lat:         unit.lat    || null,
      lng:         unit.lng    || null,
      precision:   unit.accuracy || null,
      velocidad:   unit.speed  || 0,
      resuelta:    false,
      atendidaPor: null,
      timestamp:   ts,
      fechaMX:     fechaMX(ts),
    });

    // Notificar en canal de radio de la base
    const coordStr = unit.lat
      ? `${unit.lat.toFixed(5)}, ${unit.lng.toFixed(5)}`
      : "coordenadas no disponibles";

    await db.ref("mensajes").push({
      de:        "SISTEMA",
      nombre:    "🚨 ALERTA SOS",
      texto:     `🚨 SOS ACTIVO — Unidad ${unitId} (${unit.name || "—"}) · Posición: ${coordStr} · ID Alerta: ${alertaRef.key}`,
      timestamp: ts,
      tipo:      "SOS",
      alertaId:  alertaRef.key,
    });

    // Log de auditoría
    await logEvento("SOS_ACTIVADO", {
      unidad:   unitId,
      nombre:   unit.name || "—",
      lat:      unit.lat  || null,
      lng:      unit.lng  || null,
      alertaId: alertaRef.key,
    });

    console.log(`[SOS] 🚨 Unidad ${unitId} activó SOS — AlertaID: ${alertaRef.key}`);
    return null;
  });


// ════════════════════════════════════════════════════════════
// ④ REPORTE DIARIO — 6:00am hora México
//    Snapshot completo de la flotilla: activas, inactivas,
//    estadísticas por estado, unidades más activas del día
// ════════════════════════════════════════════════════════════
exports.reporteDiario = functions
  .runWith({ timeoutSeconds: 120, memory: "256MB" })
  .pubsub.schedule("0 6 * * *")
  .timeZone(CONFIG.timezone)
  .onRun(async () => {
    const ts    = Date.now();
    const fecha = new Date(ts).toLocaleDateString("es-MX", {
      timeZone: CONFIG.timezone, year: "numeric", month: "2-digit", day: "2-digit"
    }).split("/").reverse().join("-"); // YYYY-MM-DD

    const [activasSnap, inactivasSnap, sosSnap] = await Promise.all([
      db.ref("unidades").once("value"),
      db.ref("unidades_inactivas").once("value"),
      db.ref("alertas_sos").orderByChild("timestamp")
        .startAt(ts - 24 * 60 * 60 * 1000).once("value"),
    ]);

    const activas   = activasSnap.val()   || {};
    const inactivas = inactivasSnap.val() || {};

    // Estadísticas por estado
    const porEstado = { libre: 0, ocupado: 0, descanso: 0, offline: 0, sos: 0 };
    Object.values(activas).forEach(u => {
      const s = u.status || "offline";
      porEstado[s] = (porEstado[s] || 0) + 1;
    });

    // Velocidad promedio (unidades en movimiento)
    const enMovimiento = Object.values(activas).filter(u => (u.speed || 0) > 0);
    const velPromedio  = enMovimiento.length
      ? Math.round(enMovimiento.reduce((a, u) => a + (u.speed || 0), 0) / enMovimiento.length)
      : 0;

    // SOS del día
    let sosDia = 0;
    if (sosSnap.exists()) sosSnap.forEach(() => sosDia++);

    const reporte = {
      fecha,
      generadoEn:      ts,
      generadoEnMX:    fechaMX(ts),
      sistema:         CONFIG.sistema,
      flotilla: {
        totalActivas:   Object.keys(activas).length,
        totalInactivas: Object.keys(inactivas).length,
        porEstado,
        enMovimiento:   enMovimiento.length,
        velocidadPromedio: velPromedio + " km/h",
      },
      seguridad: {
        sosDia,
      },
      unidades: Object.entries(activas).map(([id, u]) => ({
        id,
        nombre:  u.name   || "—",
        estado:  u.status || "offline",
        velocidad: u.speed || 0,
        ultimaSenal: fechaMX(u.timestamp),
      })),
    };

    await db.ref(`reportes/${fecha}`).set(reporte);

    await logEvento("REPORTE_DIARIO", {
      fecha,
      totalActivas:   reporte.flotilla.totalActivas,
      totalInactivas: reporte.flotilla.totalInactivas,
      sosDia,
    });

    console.log(`[reporte] ✅ Reporte ${fecha} — ${reporte.flotilla.totalActivas} activas, ${sosDia} SOS`);
    return null;
  });


// ════════════════════════════════════════════════════════════
// ⑤ HISTORIAL DE ESTADOS — TIEMPO REAL
//    Auditoría completa: cada cambio de estado queda
//    registrado en /historial/{unitId}/ para trazabilidad
// ════════════════════════════════════════════════════════════
exports.registrarHistorial = functions
  .database.ref("unidades/{unitId}/status")
  .onWrite(async (change, context) => {
    const antes  = change.before.val();
    const nuevo  = change.after.val();
    const unitId = context.params.unitId;

    // Sin cambio real o eliminación → ignorar
    if (antes === nuevo || !change.after.exists()) return null;

    const unitSnap = await db.ref(`unidades/${unitId}`).once("value");
    const unit     = unitSnap.val() || {};
    const ts       = Date.now();

    await db.ref(`historial/${unitId}`).push({
      de:        antes || "—",
      a:         nuevo,
      nombre:    unit.name || "—",
      lat:       unit.lat  || null,
      lng:       unit.lng  || null,
      velocidad: unit.speed || 0,
      timestamp: ts,
      fechaMX:   fechaMX(ts),
    });

    console.log(`[historial] ${unitId}: ${antes} → ${nuevo}`);
    return null;
  });


// ════════════════════════════════════════════════════════════
// ⑥ MONITOR DE CONEXIÓN — TIEMPO REAL
//    Cuando un conductor se conecta (status cambia de offline
//    a cualquier otro estado) registra el evento de conexión
// ════════════════════════════════════════════════════════════
exports.monitorConexion = functions
  .database.ref("unidades/{unitId}/status")
  .onWrite(async (change, context) => {
    const antes  = change.before.val();
    const nuevo  = change.after.val();
    const unitId = context.params.unitId;

    // Detectar conexión (offline/null → activo)
    const seConecta    = (!antes || antes === "offline") && nuevo && nuevo !== "offline";
    // Detectar desconexión (activo → offline)
    const seDesconecta = antes && antes !== "offline" && nuevo === "offline";

    if (!seConecta && !seDesconecta) return null;

    const unitSnap = await db.ref(`unidades/${unitId}`).once("value");
    const unit     = unitSnap.val() || {};
    const ts       = Date.now();
    const tipo     = seConecta ? "CONEXION" : "DESCONEXION";

    await db.ref(`conexiones/${unitId}`).push({
      tipo,
      nombre:    unit.name || "—",
      lat:       unit.lat  || null,
      lng:       unit.lng  || null,
      timestamp: ts,
      fechaMX:   fechaMX(ts),
    });

    // Actualizar última conexión conocida
    if (seConecta) {
      await db.ref(`unidades/${unitId}/ultimaConexion`).set(ts);
    }

    console.log(`[conexion] ${tipo} — ${unitId} (${unit.name || "—"})`);
    return null;
  });


// ════════════════════════════════════════════════════════════
// ⑦ ESTADÍSTICAS POR HORA — Snapshot cada hora
//    Guarda un snapshot de la flotilla en /estadisticas/
//    para construir gráficas históricas de demanda
// ════════════════════════════════════════════════════════════
exports.estadisticasHora = functions
  .runWith({ timeoutSeconds: 60, memory: "128MB" })
  .pubsub.schedule("every 60 minutes")
  .timeZone(CONFIG.timezone)
  .onRun(async () => {
    const ts       = Date.now();
    const snapshot = await db.ref("unidades").once("value");
    const unidades = snapshot.val() || {};

    const stats = { libre: 0, ocupado: 0, descanso: 0, offline: 0, sos: 0, total: 0 };
    Object.values(unidades).forEach(u => {
      const s = u.status || "offline";
      stats[s] = (stats[s] || 0) + 1;
      stats.total++;
    });

    // Clave: "2026-03-02T14:00" para consultas fáciles
    const clave = new Date(ts).toLocaleString("sv-SE", {
      timeZone: CONFIG.timezone
    }).slice(0, 16).replace(" ", "T").replace(":", "-").slice(0, 13) + "h";

    await db.ref(`estadisticas/${clave}`).set({
      ...stats,
      timestamp: ts,
      fechaMX:   fechaMX(ts),
    });

    console.log(`[estadisticas] ✅ Snapshot ${clave} — ${stats.total} unidades`);
    return null;
  });

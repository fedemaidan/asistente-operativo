const {
  getComprobantesFromSheet,
} = require("../../GoogleServices/Sheets/comprobante");
const clienteController = require("../../../controllers/clienteController");
const cajaController = require("../../../controllers/cajaController");
const movimientoController = require("../../../controllers/movimientoController");
require("../../../DBConnection");

const parseNombreToUpperCase = (nombre) => {
  return nombre.toUpperCase();
};

async function ensureCajasBase() {
  const cajasNecesarias = [
    "ENSHOP SRL",
    "ASOCIACION CONSULTORA MUTUAL",
    "EZE",
    "NICO",
    "CHEQUE",
    "ECHEQ",
    "EFECTIVO",
  ];

  for (const nombreCaja of cajasNecesarias) {
    try {
      const existsResp = await cajaController.cajaExists(nombreCaja);
      if (!existsResp.success || !existsResp.exists) {
        await cajaController.createCaja({ nombre: nombreCaja });
        console.log(`✅ Caja creada: ${nombreCaja}`);
      }
    } catch (error) {
      console.log(`❌ Error asegurando caja ${nombreCaja}: ${error.message}`);
    }
  }
}

function parseFechaDDMMYYYYToDate(fecha) {
  if (!fecha || typeof fecha !== "string") {
    console.log(`❌ Fecha inválida o no string: ${fecha}`);
    return null;
  }
  const [dia, mes, anio] = fecha.split("/");
  if (!dia || !mes || !anio) {
    console.log(
      `❌ No se pudo parsear fecha: ${fecha} -> [${dia}, ${mes}, ${anio}]`
    );
    return null;
  }

  // Crear fecha con año, mes-1 (porque Date usa 0-11), día
  const fechaParseada = new Date(Number(anio), Number(mes) - 1, Number(dia));
  console.log(`✅ Fecha parseada: ${fecha} -> ${fechaParseada.toISOString()}`);
  return fechaParseada;
}

function buildDateWithTime(baseDate, timeHHMM) {
  if (!baseDate || isNaN(baseDate.getTime())) {
    console.log(`❌ Fecha base inválida: ${baseDate}`);
    return new Date(); // Fallback a fecha actual
  }

  const horaStr = (timeHHMM || "").toString().trim();
  console.log(`🕐 Procesando hora: "${horaStr}"`);

  let horas = 0;
  let minutos = 0;
  // Solo aceptamos formato H:MM. Cualquier otra cosa ("-", "0,5", vacío) → 00:00
  if (horaStr && horaStr !== "-" && horaStr.includes(":")) {
    const parts = horaStr.split(":");
    const h = parseInt(parts[0], 10);
    const m = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    horas = Number.isFinite(h) ? h : 0;
    minutos = Number.isFinite(m) ? m : 0;
  }
  console.log(`🕐 Horas: ${horas}, Minutos: ${minutos}`);

  const fechaCompleta = new Date(baseDate);
  fechaCompleta.setHours(horas, minutos, 0, 0);

  try {
    console.log(`✅ Fecha completa: ${fechaCompleta.toISOString()}`);
  } catch (_) {}
  return fechaCompleta;
}

function obtenerFechaFacturaConFallback(fecha, hora, ultimaFechaValida) {
  console.log(`🔄 Obteniendo fecha con fallback...`);

  // Normalizar última fecha válida (00:00) o hoy si no existe
  const ultimaNormalizada =
    ultimaFechaValida && !isNaN(ultimaFechaValida.getTime())
      ? new Date(ultimaFechaValida)
      : new Date();
  ultimaNormalizada.setHours(0, 0, 0, 0);

  // 1) Intentar parsear solo la fecha (DD/MM/YYYY). Si inválida → usar última válida 00:00
  const fechaBase = parseFechaDDMMYYYYToDate(fecha);
  if (!fechaBase || isNaN(fechaBase.getTime())) {
    try {
      console.log(
        `⚠️  Fecha inválida, usando última fecha válida: ${ultimaNormalizada.toISOString()}`
      );
    } catch (_) {}
    return ultimaNormalizada;
  }

  // 2) Validar hora. Si inválida (vacía, '-', con coma o sin ':'), usar solo fecha 00:00
  const horaStr = (hora || "").toString().trim();
  const horaInvalida =
    !horaStr ||
    horaStr === "-" ||
    horaStr.includes(",") ||
    !horaStr.includes(":");
  if (horaInvalida) {
    const soloFecha = new Date(fechaBase);
    soloFecha.setHours(0, 0, 0, 0);
    try {
      console.log(
        `⚠️  Hora inválida, usando solo fecha (00:00): ${soloFecha.toISOString()}`
      );
    } catch (_) {}
    return soloFecha;
  }

  // 3) Intentar fecha + hora (formato H:MM). Si falla, usar última válida 00:00
  try {
    const fechaConHora = buildDateWithTime(fechaBase, horaStr);
    try {
      console.log(`✅ Usando fecha+hora: ${fechaConHora.toISOString()}`);
    } catch (_) {}
    return fechaConHora;
  } catch (_) {
    try {
      console.log(
        `⚠️  Error al combinar fecha y hora, usando última válida: ${ultimaNormalizada.toISOString()}`
      );
    } catch (_) {}
    return ultimaNormalizada;
  }
}

async function migrarComprobantesDesdeGoogleSheets(
  sheetId = process.env.GOOGLE_SHEET_ID
) {
  console.log("🚀 Iniciando migración de comprobantes desde Google Sheets...");

  if (!sheetId) {
    throw new Error(
      "GOOGLE_SHEET_ID no definido. Configura la variable de entorno o pásalo como argumento."
    );
  }

  await ensureCajasBase();

  try {
    const comprobantes = await getComprobantesFromSheet(sheetId);

    let creados = 0;
    let errores = 0;
    let ultimaFechaValida = new Date(); // Fecha de fallback inicial

    for (const comp of comprobantes) {
      if (comp.destino === "ASOCIACION CONSULTURA MUTUAL") {
        comp.destino = "ASOCIACION CONSULTORA MUTUAL";
      }
      try {
        const clienteResp = await clienteController.getByNombre(
          parseNombreToUpperCase(comp.cliente)
        );

        console.log(`\n📊 Procesando comprobante:`, {
          fecha: comp.fecha,
          hora: comp.hora,
          numeroComprobante: comp.numero_comprobante,
        });

        const cajaResp = await cajaController.getByNombre(comp.destino);
        const cajaId = cajaResp && cajaResp.success ? cajaResp.data._id : null;

        // Obtener fecha con fallback a la última fecha válida
        const fechaFactura = obtenerFechaFacturaConFallback(
          comp.fecha,
          comp.hora,
          ultimaFechaValida
        );

        // Actualizar última fecha válida si la actual es válida (normalizada a 00:00)
        const fechaParseadaActual = parseFechaDDMMYYYYToDate(comp.fecha);
        if (fechaParseadaActual && !isNaN(fechaParseadaActual.getTime())) {
          const normalizada = new Date(fechaParseadaActual);
          normalizada.setHours(0, 0, 0, 0);
          ultimaFechaValida = normalizada;
          try {
            console.log(
              `📅 Última fecha válida actualizada: ${ultimaFechaValida.toISOString()}`
            );
          } catch (_) {}
        }

        const movimientoData = {
          type: "INGRESO",
          numeroFactura: comp.numero_comprobante,
          fechaFactura: fechaFactura,
          clienteId: clienteResp.success ? clienteResp.data._id : null,
          cliente: {
            nombre: clienteResp.success
              ? clienteResp.data.nombre
              : comp.cliente,
            ccActivas: clienteResp.success ? clienteResp.data.ccActivas : [],
            descuento: clienteResp.success ? clienteResp.data.descuento : 0,
          },
          cuentaCorriente: comp.moneda === "-" ? "ARS" : comp.moneda,
          moneda: comp.monedaDePago,
          tipoFactura: comp.destino === "CHEQUE" ? "cheque" : "transferencia",
          caja: cajaId,
          urlImagen: comp.imagen || "",
          estado: comp.estado.startsWith("CONFIRMADO")
            ? "CONFIRMADO"
            : comp.estado || "PENDIENTE",
          nombreUsuario: comp.usuario || "Sistema",
          tipoDeCambio: Number(comp.tipoDeCambio) || 1,
          empresaId: "celulandia",
        };

        const montoEnviado =
          Number(
            typeof comp.montoEnviado === "string"
              ? comp.montoEnviado
                  .replace(/\$/g, "")
                  .replace(/\./g, "")
                  .replace(/,/g, ".")
              : comp.montoEnviado
          ) || 0;

        const resp = await movimientoController.createMovimiento(
          movimientoData,
          montoEnviado,
          false
        );

        if (resp && resp.success) {
          creados++;
        } else {
          errores++;
          console.log(
            `❌ Error creando movimiento para comprobante ${
              comp.numero_comprobante
            }: ${resp && resp.error ? resp.error : "Error desconocido"}`
          );
        }
      } catch (err) {
        errores++;
        console.log(
          `❌ Error procesando comprobante ${
            comp.numero_comprobante || "(sin número)"
          }: ${err.message}`
        );
      }
    }

    console.log("\n📊 RESUMEN MIGRACIÓN COMPROBANTES:");
    console.log(`✅ Movimientos creados: ${creados}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📋 Total procesados: ${creados + errores}`);

    return { success: true, creados, errores };
  } catch (error) {
    console.error(
      "💥 Error durante la migración de comprobantes:",
      error.message
    );
    throw error;
  }
}

module.exports = {
  migrarComprobantesDesdeGoogleSheets,
  parseNombreToUpperCase,
};

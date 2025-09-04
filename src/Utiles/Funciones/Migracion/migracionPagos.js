const { getPagosFromSheet } = require("../../GoogleServices/Sheets/pago");
const movimientoController = require("../../../controllers/movimientoController");
const cajaController = require("../../../controllers/cajaController");
require("../../../DBConnection");

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
  return fechaParseada;
}

function buildDateWithTime(baseDate, timeHHMM) {
  if (!baseDate || isNaN(baseDate.getTime())) {
    console.log(`❌ Fecha base inválida: ${baseDate}`);
    return new Date(); // Fallback a fecha actual
  }

  const horaStr = (timeHHMM || "00:00").toString().trim();

  // Manejar formato "H:MM" (sin cero inicial)
  const [horas, minutos] = horaStr.split(":").map((num) => parseInt(num) || 0);

  const fechaCompleta = new Date(baseDate);
  fechaCompleta.setHours(horas, minutos, 0, 0);

  return fechaCompleta;
}

async function migrarPagosDesdeGoogleSheets(
  sheetId = process.env.GOOGLE_SHEET_ID
) {
  console.log("🚀 Iniciando migración de pagos desde Google Sheets...");

  if (!sheetId) {
    throw new Error(
      "GOOGLE_SHEET_ID no definido. Configura la variable de entorno o pásalo como argumento."
    );
  }

  try {
    console.log("📊 Obteniendo pagos desde Google Sheets...");
    const pagos = await getPagosFromSheet(sheetId);

    let creados = 0;
    let errores = 0;

    for (const pago of pagos) {
      try {
        let cajaId = null;
        if (pago.total && pago.total.caja) {
          try {
            const cajaResp = await cajaController.getByNombre(pago.total.caja);
            cajaId = cajaResp && cajaResp.success ? cajaResp.data._id : null;
          } catch (_) {}
        }

        const cuentaCorriente =
          pago.moneda === "USD" ? "USD BLUE" : pago.moneda;
        const moneda = cuentaCorriente === "ARS" ? "ARS" : "USD";

        const fechaBase = parseFechaDDMMYYYYToDate(pago.fecha);
        const fechaFactura = buildDateWithTime(fechaBase, pago.hora);

        const movimientoData = {
          type: pago.type || "EGRESO",
          empresaId: pago.empresaId || "celulandia",
          numeroFactura: null,
          fechaFactura,
          clienteId: null,
          cliente: { nombre: null, ccActivas: [], descuento: 0 },
          cuentaCorriente: cuentaCorriente,
          moneda: moneda,
          tipoFactura: "transferencia",
          caja: cajaId,
          urlImagen: "",
          estado: "CONFIRMADO",
          nombreUsuario: pago.usuario,
          tipoDeCambio: Number(pago.tipoDeCambio) || 0,
          concepto: (pago.total && pago.total.concepto) || "Pago",
          total: {
            ars: Number(pago.total?.ars) || 0,
            usdOficial: Number(pago.total?.usdOficial) || 0,
            usdBlue: Number(pago.total?.usdBlue) || 0,
          },
        };

        // Crear directamente el movimiento con los totales ya parseados
        const resp = await movimientoController.create(movimientoData);

        if (resp && resp.success) {
          creados++;
        } else {
          errores++;
          console.log(
            `❌ Error creando movimiento para pago ${
              (pago.total && pago.total.concepto) || "(sin concepto)"
            }: ${resp && resp.error ? resp.error : "Error desconocido"}`
          );
        }
      } catch (err) {
        errores++;
        console.log(
          `❌ Error procesando pago ${
            (pago.total && pago.total.concepto) || "(sin concepto)"
          }: ${err.message}`
        );
      }
    }

    console.log("\n📊 RESUMEN MIGRACIÓN PAGOS:");
    console.log(`✅ Pagos creados: ${creados}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📋 Total procesados: ${creados + errores}`);

    return { success: true, creados, errores };
  } catch (error) {
    console.error("💥 Error durante la migración de pagos:", error.message);
    throw error;
  }
}

module.exports = migrarPagosDesdeGoogleSheets;

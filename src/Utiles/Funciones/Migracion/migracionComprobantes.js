const {
  getComprobantesFromSheet,
} = require("../../GoogleServices/Sheets/comprobante");
const clienteController = require("../../../controllers/clienteController");
const cajaController = require("../../../controllers/cajaController");
const movimientoController = require("../../../controllers/movimientoController");
require("../../../DBConnection");

const parseNombreToUpperCase = (nombre) => {
  return nombre;
};

async function ensureCajasBase() {
  const cajasNecesarias = [
    "ENSHOP SRL",
    "ASOCIACION CONSULTURA MUTUAL",
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
      } else {
        console.log(`ℹ️ Caja ya existe: ${nombreCaja}`);
      }
    } catch (error) {
      console.log(`❌ Error asegurando caja ${nombreCaja}: ${error.message}`);
    }
  }
}

function parseFechaDDMMYYYYToDate(fecha) {
  if (!fecha || typeof fecha !== "string") return null;
  const [dia, mes, anio] = fecha.split("/");
  if (!dia || !mes || !anio) return null;
  return new Date(anio, Number(mes) - 1, Number(dia));
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
    console.log("📊 Obteniendo comprobantes desde Google Sheets...");
    const comprobantes = await getComprobantesFromSheet(sheetId);

    let creados = 0;
    let errores = 0;

    for (const comp of comprobantes) {
      try {
        const clienteResp = await clienteController.getByNombre(
          parseNombreToUpperCase(comp.cliente)
        );

        const cajaResp = await cajaController.getByNombre(comp.destino);
        const cajaId = cajaResp && cajaResp.success ? cajaResp.data._id : null;

        if (comp.destino === "EFECTIVO") {
          console.log(`🔍 EFECTIVO - Respuesta:`, cajaResp);
          console.log(`🆔 EFECTIVO - ID obtenido:`, cajaId);
        }

        const fechaFactura = parseFechaDDMMYYYYToDate(comp.fecha);

        console.log(
          comprobantes.filter((c) => c.cliente == "sandra cavagnaro")
        );

        const movimientoData = {
          type: "INGRESO",
          numeroFactura: comp.numero_comprobante,
          fechaFactura: fechaFactura,
          clienteId: clienteResp.success ? clienteResp.data._id : null,
          cliente: {
            nombre: parseNombreToUpperCase(comp.cliente),
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

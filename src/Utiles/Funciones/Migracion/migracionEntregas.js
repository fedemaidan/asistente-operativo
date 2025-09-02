const { getEntregasFromSheet } = require("../../GoogleServices/Sheets/entrega");
const { parseNombreToUpperCase } = require("./migracionComprobantes");

function parseFechaDDMMYYYYToDate(fecha) {
  if (!fecha || typeof fecha !== "string") return null;
  const [dia, mes, anio] = fecha.split("/");
  if (!dia || !mes || !anio) return null;
  return new Date(anio, Number(mes) - 1, Number(dia));
}

async function migrarEntregasDesdeGoogleSheets(
  sheetId = process.env.GOOGLE_SHEET_ID
) {
  console.log("🚀 Iniciando migración de entregas desde Google Sheets...");

  if (!sheetId) {
    throw new Error(
      "GOOGLE_SHEET_ID no definido. Configura la variable de entorno o pásalo como argumento."
    );
  }

  try {
    console.log("📊 Obteniendo entregas desde Google Sheets...");
    const entregas = await getEntregasFromSheet(sheetId);

    let creados = 0;
    let errores = 0;

    const clienteController = require("../../../controllers/clienteController");
    for (const entrega of entregas) {
      const clienteResp = await clienteController.getByNombre(
        parseNombreToUpperCase(entrega.proveedorOCliente)
      );
      try {
        // Combinar fecha y hora en un solo objeto Date
        const fechaBase =
          parseFechaDDMMYYYYToDate(entrega.fechaCuenta) || new Date();
        const horaCuenta = entrega.horaCuenta || "00:00";

        // Parsear la hora (formato HH:MM)
        const [horas, minutos] = horaCuenta
          .split(":")
          .map((num) => parseInt(num) || 0);

        // Crear Date completo con fecha y hora
        const fechaCuentaCompleta = new Date(fechaBase);
        fechaCuentaCompleta.setHours(horas, minutos, 0, 0);

        const cuentaPendienteData = {
          descripcion: entrega.descripcion || "",
          fechaCuenta: fechaCuentaCompleta,
          fechaCreacion: new Date(),
          proveedorOCliente: clienteResp.success
            ? clienteResp.data.nombre
            : entrega.proveedorOCliente,
          descuentoAplicado: entrega.descuentoAplicado,
          subTotal: entrega.subTotal,
          montoTotal: entrega.montoTotal,
          moneda: entrega.moneda,
          cc: entrega.cc,
          tipoDeCambio: Number(entrega.tipoDeCambio) || 1,
          usuario: "Sistema",
          empresaId: "celulandia",
        };

        const cuentaPendienteController = require("../../../controllers/cuentaPendienteController");
        const resp = await cuentaPendienteController.createCuentaPendiente(
          cuentaPendienteData
        );

        if (resp && resp.success) {
          creados++;
        } else {
          errores++;
          console.log(
            `❌ Error creando entrega ${JSON.stringify(entrega)}: ${
              resp && resp.error ? resp.error : "Error desconocido"
            }`
          );
        }
      } catch (err) {
        errores++;
        console.log(
          `❌ Error procesando entrega ${
            entrega.descripcion || "(sin descripción)"
          }: ${err.message}`
        );
      }
    }

    console.log("\n📊 RESUMEN MIGRACIÓN ENTREGAS:");
    console.log(`✅ Entregas creadas: ${creados}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📋 Total procesados: ${creados + errores}`);

    return { success: true, creados, errores };
  } catch (error) {
    console.error("💥 Error durante la migración de entregas:", error.message);
    throw error;
  }
}

module.exports = migrarEntregasDesdeGoogleSheets;

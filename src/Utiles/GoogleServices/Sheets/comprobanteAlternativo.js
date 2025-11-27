const { getRowsValues } = require("../General");
const MovimientoController = require("../../../controllers/movimientoController");
const ClienteController = require("../../../controllers/clienteController");
const CajaController = require("../../../controllers/cajaController");
const { getFechaArgentina } = require("../../Funciones/HandleDates");

async function importarComprobantesAlternativo() {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID_ALTERNATIVO;
    if (!sheetId) {
      return { success: false, error: "GOOGLE_SHEET_ID_ALTERNATIVO no está configurado" };
    }
    const SHEET_NAME = "Comprobantes";
    const rows = await getRowsValues(sheetId, SHEET_NAME);
    if (!Array.isArray(rows) || rows.length <= 1) {
      return { success: true, created: 0, errors: [] };
    }

    const dataRows = rows.slice(1);
    let created = 0;
    const errors = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] || [];
      const [clienteNombreRaw, cajaNombreRaw, montoRaw, monedaRaw, ccRaw] = row;

      const rowNum = i + 2;
      const clienteNombre = String(clienteNombreRaw || "").trim();
      const cajaNombre = String(cajaNombreRaw || "").trim();
      const moneda = String(monedaRaw || "").trim().toUpperCase();
      const cc = String(ccRaw || "").trim().toUpperCase();
      const monto = Number(String(montoRaw || "0").toString().replace(/[^0-9.-]/g, ""));

      if (!clienteNombre || !cajaNombre || !monto || !moneda || !cc) {
        errors.push({ row: rowNum, error: "Fila incompleta o inválida" });
        continue;
      }

      if (!["ARS", "USD"].includes(moneda)) {
        errors.push({ row: rowNum, error: `Moneda inválida: ${moneda}` });
        continue;
      }
      const ccValidas = ["ARS", "USD BLUE", "USD OFICIAL"];
      if (!ccValidas.includes(cc)) {
        errors.push({ row: rowNum, error: `CC inválida: ${cc}` });
        continue;
      }

      try {
        // Buscar cliente por nombre
        const cliResp = await ClienteController.getByNombre(clienteNombre);
        let clienteId = null;
        let clienteObj = { nombre: clienteNombre, descuento: 0, ccActivas: [] };
        if (cliResp?.success && cliResp?.data) {
          const cli = cliResp.data;
          clienteId = cli._id;
          clienteObj = {
            nombre: cli.nombre,
            descuento: cli.descuento || 0,
            ccActivas: Array.isArray(cli.ccActivas) ? cli.ccActivas : [],
          };
        }

        // Buscar caja por nombre (obligatoria)
        const cajaResp = await CajaController.getByNombre(cajaNombre);
        if (!cajaResp?.success || !cajaResp?.data?._id) {
          errors.push({ row: rowNum, error: `Caja no encontrada: ${cajaNombre}` });
          continue;
        }
        const cajaId = cajaResp.data._id;

        const movimientoData = {
          type: "INGRESO",
          tipoFactura: "transferencia",
          moneda,
          cuentaCorriente: cc,
          caja: cajaId,
          clienteId,
          cliente: clienteObj,
          fechaFactura: getFechaArgentina(),
          nombreUsuario: "Sistema",
          descripcion: "",
          estado: "PENDIENTE",
          empresaId: "celulandia",
          active: false,
        };

        const res = await MovimientoController.createMovimiento(
          movimientoData,
          monto,
          true, 
          true
        );

        if (!res?.success) {
          errors.push({ row: rowNum, error: res?.error || "Error al crear movimiento" });
          continue;
        }
        created += 1;
      } catch (e) {
        errors.push({ row: rowNum, error: e?.message || String(e) });
      }
    }

    return { success: errors.length === 0, created, errors };
  } catch (error) {
    return { success: false, error: error.message || error };
  }
}

module.exports = { importarComprobantesAlternativo };



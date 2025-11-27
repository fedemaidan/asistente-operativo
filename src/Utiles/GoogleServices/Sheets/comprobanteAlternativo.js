const { getRowsValues, clearSheetDataExceptHeader } = require("../General");
const MovimientoController = require("../../../controllers/movimientoController");
const Movimiento = require("../../../models/movimiento.model");
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
    try {
      console.log(`[ALT SHEET] ${SHEET_NAME} total rows:`, Array.isArray(rows) ? rows.length : 0);
      if (Array.isArray(rows) && rows.length > 0) {
        console.log(`[ALT SHEET] ${SHEET_NAME} headers (row 1):`, rows[0]);
        console.log(
          `[ALT SHEET] ${SHEET_NAME} sample rows (2..4):`,
          rows.slice(1, 4)
        );
      }
    } catch (logErr) {
      // ignore logging errors
    }
    if (!Array.isArray(rows) || rows.length <= 1) {
      return { success: true, created: 0, errors: [], createdDocs: [] };
    }

    const dataRows = rows.slice(1);
    let created = 0;
    const errors = [];
    const createdDocs = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] || [];
      const [clienteNombreRaw, cajaNombreRaw, montoRaw, monedaRaw, ccRaw] = row;

      const rowNum = i + 2;
      const clienteNombre = String(clienteNombreRaw || "").trim();
      const cajaNombre = String(cajaNombreRaw || "").trim();
      const moneda = String(monedaRaw || "").trim().toUpperCase();
      const cc = String(ccRaw || "").trim().toUpperCase();
      const monto = Number(String(montoRaw || "0").toString().replace(/[^0-9.-]/g, ""));
      try {
        console.log(`[ALT SHEET] ${SHEET_NAME} row ${rowNum} raw:`, row);
        console.log(
          `[ALT SHEET] ${SHEET_NAME} row ${rowNum} parsed -> cliente: "${clienteNombre}", caja: "${cajaNombre}", moneda: "${moneda}", cc: "${cc}", monto: ${monto}`
        );
      } catch (_) {}

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
          console.log(`[ALT SHEET] ${SHEET_NAME} row ${rowNum} caja no encontrada:`, cajaNombre);
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
        if (res?.data) {
          const populated = await Movimiento.findById(res.data._id).populate("caja");
          createdDocs.push(populated || res.data);
        }
      } catch (e) {
        errors.push({ row: rowNum, error: e?.message || String(e) });
      }
    }

    // Limpiar datos de la hoja (preservar headers) solo si no hubo errores
    if (errors.length === 0) {
      await clearSheetDataExceptHeader(sheetId, SHEET_NAME);
    }
    return { success: errors.length === 0, created, errors, createdDocs };
  } catch (error) {
    return { success: false, error: error.message || error, created: 0, errors: [String(error)], createdDocs: [] };
  }
}

module.exports = { importarComprobantesAlternativo };



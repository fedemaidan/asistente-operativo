const MovimientoController = require("../controllers/movimientoController");
const { getFechaArgentina } = require("../Utiles/Funciones/HandleDates");
const {
  addRow,
  checkIfSheetExists,
  createSheet,
  addFormattedHeaders,
  updateSheetWithBatchDelete,
} = require("../Utiles/GoogleServices/General");

async function exportarPagosASheet(spreadsheetId) {
  try {
    const SHEET_NAME = "Pagos";
    const HEADERS = [
      "ID Movimiento",
      "Fecha",
      "Descripción",
      "Categoria",
      "Caja",
      "Moneda",
      "CC",
      "Tipo de cambio",
      "Estado",
      "Usuario",
      "Total ARS",
      "Total USD Blue",
      "Total USD Oficial",
      "Campos de búsqueda",
      "Movimiento complementario",
    ];

    // Asegurar existencia de la hoja
    const exists = await checkIfSheetExists(spreadsheetId, SHEET_NAME);
    if (!exists) {
      const newSheetId = await createSheet(spreadsheetId, SHEET_NAME);
      if (newSheetId) {
        await addFormattedHeaders(spreadsheetId, SHEET_NAME, newSheetId, HEADERS);
      }
    }

    // Obtener todos los EGRESOS activos
    const resp = await MovimientoController.getAll(
      {},
      "caja,cliente",
      { filter: { type: "EGRESO", active: true } }
    );
    if (!resp?.success) {
      return { success: false, error: resp?.error || "No se pudieron obtener los pagos" };
    }
    const pagos = Array.isArray(resp.data) ? resp.data : [];

    let totalAExportarARS = 0;
    let totalAExportarUSDBlue = 0;
    let totalAExportarUSDOficial = 0;

    const dataRows = pagos.map((p) => {
      const idMovimiento = p?._id ? String(p._id) : "";
      const fecha = p?.fechaFactura.toISOString();
      const categoria = p?.categoria || "";
      const descripcionMovimiento = p?.descripcion || "";
      const cajaNombre = p?.caja?.nombre;
      const moneda = p?.moneda || "";
      const cc = p?.cuentaCorriente || "";
      const tipoDeCambio = p?.tipoDeCambio != null ? p.tipoDeCambio : 1;
      const estado = p?.estado || "";
      const usuario = p?.nombreUsuario || "";
      const totARS = p?.total?.ars != null ? p.total.ars : 0;
      const totBlue = p?.total?.usdBlue != null ? p.total.usdBlue : 0;
      const totOf = p?.total?.usdOficial != null ? p.total.usdOficial : 0;
      const camposBusqueda = p?.camposBusqueda || "";
      const movimientoComplementario = p?.movimientoComplementario ? String(p.movimientoComplementario) : "";
      
      totalAExportarARS += totARS;
      totalAExportarUSDBlue += totBlue;
      totalAExportarUSDOficial += totOf;

      return [
        idMovimiento,
        fecha,
        descripcionMovimiento,
        categoria,
        cajaNombre,
        moneda,
        cc,
        tipoDeCambio,
        estado,
        usuario,
        totARS.toFixed(2),
        totBlue.toFixed(2),
        totOf.toFixed(2),
        camposBusqueda,
        movimientoComplementario,
      ];
    });

    console.log(
      "[Exportar Pagos] Totales a exportar:",
      {
        totalAExportarARS,
        totalAExportarUSDBlue,
        totalAExportarUSDOficial,
      }
    );

    await updateSheetWithBatchDelete(
      spreadsheetId,
      `${SHEET_NAME}!A2:Z100000`,
      dataRows,
      8
    );

    return { success: true, count: dataRows.length, totalAExportarARS, totalAExportarUSDBlue, totalAExportarUSDOficial };
  } catch (error) {
    return { success: false, error };
  }
}

module.exports = { exportarPagosASheet };



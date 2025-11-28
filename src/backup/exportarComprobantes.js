const MovimientoController = require("../controllers/movimientoController");
const {
  checkIfSheetExists,
  createSheet,
  addFormattedHeaders,
  updateSheetWithBatchDelete,
} = require("../Utiles/GoogleServices/General");

async function exportarComprobantesASheet(spreadsheetId) {
  try {
    const SHEET_NAME = "Comprobantes";
    const HEADERS = [
      "Número Comprobante",
      "Fecha",
      "Hora",
      "Cliente",
      "ID Cliente",
      "Caja",
      "Moneda",
      "CC",
      "Tipo de cambio",
      "Estado",
      "Usuario",
      "Total ARS",
      "Total USD Blue",
      "Total USD Oficial",
      "Imagen",
      "Campos de búsqueda",
      "Movimiento complementario",
    ];

    const exists = await checkIfSheetExists(spreadsheetId, SHEET_NAME);
    if (!exists) {
      const newSheetId = await createSheet(spreadsheetId, SHEET_NAME);
      if (newSheetId) {
        await addFormattedHeaders(spreadsheetId, SHEET_NAME, newSheetId, HEADERS);
      }
    }

    let totalAExportarARS = 0;
    let totalAExportarUSDBlue = 0;
    let totalAExportarUSDOficial = 0;

    const resp = await MovimientoController.getAll(
      {},
      "caja,clienteId",
      { filter: { type: "INGRESO", active: true } }
    );
    if (!resp?.success) {
      return { success: false, error: resp?.error || "No se pudieron obtener los comprobantes" };
    }
    const comprobantes = Array.isArray(resp.data) ? resp.data : [];

    const dataRows = comprobantes.map((m) => {
      const numero = m?.numeroFactura || m?.descripcion || (m?._id ? String(m._id) : "");
      const fecha = m?.fechaFactura.toISOString();
      const descripcion = m?.descripcion || "";
      const categoria = m?.categoria || "";
      const clienteNombre =
        (m?.clienteId && m?.clienteId?.nombre) ? m.clienteId.nombre
        : (m?.cliente?.nombre || "");
      const clienteId =
        m?.clienteId
          ? (typeof m.clienteId === "string"
              ? m.clienteId
              : (m?.clienteId?._id ? String(m.clienteId._id) : ""))
          : "";
      const cajaNombre = m?.caja?.nombre;
      const moneda = m?.moneda || "";
      const cc = m?.cuentaCorriente || "";
      const tipoDeCambio = m?.tipoDeCambio != null ? m.tipoDeCambio : 1;
      const estado = m?.estado || "";
      const usuario = m?.nombreUsuario || "";
      const totARS = m?.total?.ars != null ? m.total.ars : 0;
      const totBlue = m?.total?.usdBlue != null ? m.total.usdBlue : 0;
      const totOf = m?.total?.usdOficial != null ? m.total.usdOficial : 0;
      const imagen = m?.urlImagen || "";
      const camposBusqueda = m?.camposBusqueda || "";
      const movimientoComplementario = m?.movimientoComplementario ? String(m.movimientoComplementario) : "";
    
      totalAExportarARS += totARS;
      totalAExportarUSDBlue += totBlue;
      totalAExportarUSDOficial += totOf;

      return [
        numero,
        fecha,
        descripcion,
        categoria,
        clienteNombre,
        clienteId,
        cajaNombre,
        moneda,
        cc,
        tipoDeCambio,
        estado,
        usuario,
        totARS.toFixed(2),
        totBlue.toFixed(2),
        totOf.toFixed(2),
        imagen,
        camposBusqueda,
        movimientoComplementario,
      ];
    });

    console.log(
      "[Exportar Comprobantes] Totales a exportar:",
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

module.exports = { exportarComprobantesASheet };



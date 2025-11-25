const CuentaPendienteController = require("../controllers/cuentaPendienteController");
const {
  addRow,
  checkIfSheetExists,
  createSheet,
  addFormattedHeaders,
  updateSheetWithBatchDelete,
} = require("../Utiles/GoogleServices/General");

async function exportarEntregasASheet(spreadsheetId) {
  try {
    const SHEET_NAME = "Entregas";
    const HEADERS = [
      "ID Cuenta Pendiente",
      "Número Entrega",
      "Fecha",
      "Cliente",
      "Moneda",
      "CC",
      "Descuento Aplicado",
      "Tipo de cambio",
      "Usuario",
      "Subtotal ARS",
      "Subtotal USD Blue",
      "Subtotal USD Oficial",
      "Total ARS",
      "Total USD Blue",
      "Total USD Oficial",
      "Campos de búsqueda",
    ];

    // Asegurar existencia de la hoja y headers
    const exists = await checkIfSheetExists(spreadsheetId, SHEET_NAME);
    if (!exists) {
      const newSheetId = await createSheet(spreadsheetId, SHEET_NAME);
      if (newSheetId) {
        await addFormattedHeaders(spreadsheetId, SHEET_NAME, newSheetId, HEADERS);
      }
    }

    // Obtener todas las entregas (cuentas pendientes) activas
    const resp = await CuentaPendienteController.getAll({}, "cliente", { filter: { active: true } });
    if (!resp?.success) {
      return { success: false, error: resp?.error || "No se pudieron obtener las entregas" };
    }
    const entregas = Array.isArray(resp.data) ? resp.data : [];

    const dataRows = entregas.map((e) => {
      const idCuentaPendiente = e?._id ? String(e._id) : "";
      const fechaDate = e?.fechaCuenta ? new Date(e.fechaCuenta) : null;
      const fecha = fechaDate && !isNaN(fechaDate.getTime()) ? fechaDate.toISOString() : "";
      const numeroEntrega = e?.descripcion || "";
      const clienteNombre = (e?.cliente?.nombre || e?.proveedorOCliente || "") + (e?.cliente?._id ? `-${e.cliente._id.toString()}` : "");
      const moneda = e?.moneda || "";
      const cc = e?.cc || "";
      const tipoDeCambio = e?.tipoDeCambio != null ? e.tipoDeCambio : 1;
      const descuentoAplicado = e?.descuentoAplicado != null ? e.descuentoAplicado : 1;
      const usuario = e?.usuario || "";

      const subTotal = e?.subTotal || {};
      const subARS = subTotal?.ars != null ? subTotal.ars : 0;
      const subBlue = subTotal?.usdBlue != null ? subTotal.usdBlue : 0;
      const subOf = subTotal?.usdOficial != null ? subTotal.usdOficial : 0;

      const total = e?.montoTotal || {};
      const totARS = total?.ars != null ? total.ars : 0;
      const totBlue = total?.usdBlue != null ? total.usdBlue : 0;
      const totOf = total?.usdOficial != null ? total.usdOficial : 0;

      const camposBusqueda = e?.camposBusqueda || "";

      return [
        idCuentaPendiente,
        numeroEntrega,
        fecha,
        clienteNombre,
        moneda,
        cc,
        descuentoAplicado,
        tipoDeCambio,
        usuario,
        subARS,
        subBlue,
        subOf,
        totARS.toFixed(2),
        totBlue.toFixed(2),
        totOf.toFixed(2),
        camposBusqueda,
      ];
    });

    await updateSheetWithBatchDelete(
      spreadsheetId,
      `${SHEET_NAME}!A2:Z100000`,
      dataRows,
      8
    );

    return { success: true, count: dataRows.length };
  } catch (error) {
    return { success: false, error };
  }
}

module.exports = { exportarEntregasASheet };


const ClienteController = require("../controllers/clienteController");
const {
  addRow,
  checkIfSheetExists,
  createSheet,
  addFormattedHeaders,
  updateSheetWithBatchDelete,
} = require("../Utiles/GoogleServices/General");


async function exportarClientesASheet(spreadsheetId) {
  try {
    const SHEET_NAME = "Clientes";
    const HEADERS = [
      "Nombre",
      "Descuento",
      "CC Activas",
    ];

    const exists = await checkIfSheetExists(spreadsheetId, SHEET_NAME);
    if (!exists) {
      const newSheetId = await createSheet(spreadsheetId, SHEET_NAME);
      if (newSheetId) {
        await addFormattedHeaders(spreadsheetId, SHEET_NAME, newSheetId, HEADERS);
      }
    }

    // Filtro: activos cuando existe el campo, o registros sin 'active'
    const resp = await ClienteController.getAll({}, "", {
      filter: { $or: [{ active: true }, { active: { $exists: false } }] },
    });
    if (!resp?.success) {
      return { success: false, error: resp?.error || "No se pudieron obtener los clientes" };
    }
    const clientes = Array.isArray(resp.data) ? resp.data : [];

    // Escribir filas
    const dataRows = clientes.map((c) => {
      const nombre =
        c && c._id && c.nombre ? `${c.nombre}-${c._id}` : (c?.nombre || "");
      const descuento = c?.descuento != null ? Number(c.descuento) : 0;
      const ccActivas = Array.isArray(c?.ccActivas) ? c.ccActivas.join(", ") : "";
      return [nombre, descuento, ccActivas];
    });

    await updateSheetWithBatchDelete(
      spreadsheetId,
      `${SHEET_NAME}!A2:C10000`,
      dataRows,
      3
    );

    return { success: true, count: dataRows.length };
  } catch (error) {
    return { success: false, error };
  }
}

module.exports = { exportarClientesASheet };




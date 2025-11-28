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
      "ID Cliente",
      "Descuento",
      "CC Activas",
    ];

    console.log("[Exportar Clientes] Inicio", { spreadsheetId, sheet: SHEET_NAME });
    console.log("[Exportar Clientes][debug] HEADERS:", HEADERS);

    const exists = await checkIfSheetExists(spreadsheetId, SHEET_NAME);
    if (!exists) {
      const newSheetId = await createSheet(spreadsheetId, SHEET_NAME);
      if (newSheetId) {
        await addFormattedHeaders(spreadsheetId, SHEET_NAME, newSheetId, HEADERS);
      }
    }

    // Filtro: activos cuando existe el campo, o registros sin 'active'
    // Exportar TODOS los clientes sin filtrar por 'active'
    console.log("[Exportar Clientes][debug] Llamando getAll sin filtros...");
    const resp = await ClienteController.getAll({}, "", {});
    console.log(
      "[Exportar Clientes][debug] resp.success:",
      resp?.success,
      "esArray(data):",
      Array.isArray(resp?.data),
      "len:",
      Array.isArray(resp?.data) ? resp.data.length : null
    );
    if (!resp?.success) {
      console.log("[Exportar Clientes][debug] error getAll:", resp?.error);
      return { success: false, error: resp?.error || "No se pudieron obtener los clientes" };
    }
    const clientes = Array.isArray(resp.data) ? resp.data : [];
    if (clientes.length === 0) {
      try {
        const countResp = await ClienteController.count({});
        console.log(
          "[Exportar Clientes][debug] count() en BD:",
          countResp?.success ? countResp?.data : "(error)",
          countResp?.error || ""
        );
      } catch (e) {
        console.log("[Exportar Clientes][debug] error al contar clientes:", e?.message || String(e));
      }
    }
    console.log("[Exportar Clientes][debug] clientes a procesar:", clientes.length);

    // Escribir filas
    const dataRows = clientes.map((c) => {
      const nombre = c?.nombre || "";
      const idCliente = c?._id ? String(c._id) : "";
      const descuento = c?.descuento != null ? Number(c.descuento) : 0;
      const ccActivas = Array.isArray(c?.ccActivas) ? c.ccActivas.join(", ") : "";
      return [nombre, idCliente, descuento, ccActivas];
    });
    console.log("[Exportar Clientes][debug] filas a exportar:", dataRows.length);

    await updateSheetWithBatchDelete(
      spreadsheetId,
      `${SHEET_NAME}!A2:D10000`,
      dataRows,
      3
    );

    return { success: true, count: dataRows.length };
  } catch (error) {
    console.log("[Exportar Clientes][debug] error inesperado:", error?.message || String(error));
    return { success: false, error };
  }
}

module.exports = { exportarClientesASheet };




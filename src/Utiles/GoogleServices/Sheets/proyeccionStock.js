const general_range = "Proyección Stock!A2:Z10000";
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const {
  updateSheetWithBatchDelete,
  checkIfSheetExists,
  addFormattedHeaders,
  createSheet,
  addRow,
} = require("../General");

function getArrayToSheetGeneral(item) {
  const values = [
    item.codigo,
    item.descripcion,
    item.cantidad,
    item.ventas15Dias,
    item.ventasProyectadas,
    item.diasSinStock,
  ];
  return values;
}

function getTitlesToSheetGeneral() {
  return [
    "Código",
    "Descripción",
    "Cantidad",
    "Ventas 15 días",
    "Ventas proyectadas (3 meses)",
    "Días para acabar stock",
  ];
}

async function updateProyeccionToSheet(stockProyeccion, sheetName) {
  try {
    const headers = getTitlesToSheetGeneral();
    const sheetExists = await checkIfSheetExists(GOOGLE_SHEET_ID, sheetName);

    if (!sheetExists) {
      const newSheetId = await createSheet(GOOGLE_SHEET_ID, sheetName);

      if (newSheetId) {
        await addFormattedHeaders(
          GOOGLE_SHEET_ID,
          sheetName,
          newSheetId,
          headers
        );
      }
    }

    const values = stockProyeccion.map((item) => getArrayToSheetGeneral(item));
    await updateSheetWithBatchDelete(
      GOOGLE_SHEET_ID,
      `${sheetName}!A2:Z10000`,
      values,
      0
    );
  } catch (error) {
    console.error(
      "Error al actualizar la proyección en la hoja de cálculo:",
      error
    );
  }
}

module.exports = {
  updateProyeccionToSheet,
};

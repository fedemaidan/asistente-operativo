const general_range = "Proyección Stock!A2:Z10000";
const botSingleton = require("../../botSingleton");
const {
  updateSheetWithBatchDelete,
  checkIfSheetExists,
  addFormattedHeaders,
  createSheet,
  addRow,
  getRowsValues,
} = require("../General");

const users = botSingleton.getUsers();

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
    "Ventas período",
    "Ventas proyectadas (3 meses)",
    "Días para acabar stock",
  ];
}

async function getArticulosIgnoradosFromSheet(GOOGLE_SHEET_ID) {
  const data = await getRowsValues(
    GOOGLE_SHEET_ID,
    "Ignorar Articulos",
    "A2:A10000"
  );

  const res = data.map((row) => ({ codigo: row[0], descripcion: row[1] }));
  console.log("IGNORAR", res);
  return res;
}

async function updateProyeccionToSheet(
  stockProyeccion,
  sheetName,
  GOOGLE_SHEET_ID
) {
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
  getArticulosIgnoradosFromSheet,
};

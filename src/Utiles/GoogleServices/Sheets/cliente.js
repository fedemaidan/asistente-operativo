const general_range = "ClientesRAW!A1:Z1000";
const GOOGLE_SHEET_CLIENTS_ID = process.env.GOOGLE_SHEET_CLIENTS_ID;
const { addRow, updateRow, getRowsValues } = require("../General");

async function getArrayToSheetGeneral(cliente) {
  const data = await getRows(GOOGLE_SHEET_ID, general_range);

  const values = [cliente];
  return values;
}

async function getClientesFromSheet() {
  const data = await getRowsValues(
    GOOGLE_SHEET_CLIENTS_ID,
    "ClientesRAW",
    "A2:A1000"
  );

  return data;
}

async function addClienteToSheet(cliente) {
  const values = await getArrayToSheetGeneral(cliente);
  await addRow(GOOGLE_SHEET_ID, values, general_range);
}

async function updateClienteStatus(cliente) {
  const values = await getArrayToSheetGeneral(cliente);

  await updateRow(GOOGLE_SHEET_ID, values, general_range, 2, cliente.cuit);
}

module.exports = {
  getClientesFromSheet,
  addClienteToSheet,
  updateClienteStatus,
};

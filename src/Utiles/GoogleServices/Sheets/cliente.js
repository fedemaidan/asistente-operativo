const general_range = "ClienteRAW!A1:Z1000";
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const { addRow, updateRow } = require("../General");

async function getArrayToSheetGeneral(cliente) {
  const values = [
    cliente.nombre,
    cliente.cuit,
    cliente.dni,
    cliente.email,
    cliente.telefono,
    cliente.direccion,
    cliente.nuevoSaldo,
    cliente.saldoAnterior,
    cliente.estado,
  ];
  return values;
}

async function addClienteToSheet(cliente) {
  const values = await getArrayToSheetGeneral(cliente);
  await addRow(GOOGLE_SHEET_ID, values, general_range);
}

async function updateClienteStatus(cliente) {
  const values = await getArrayToSheetGeneral(cliente);

  await updateRow(GOOGLE_SHEET_ID, values, general_range, 2, cliente.cuit);
}

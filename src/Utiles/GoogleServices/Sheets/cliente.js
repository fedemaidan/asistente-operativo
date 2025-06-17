const general_range = "ClientesRAW!A2:C10000";
const { addRow, updateRow, getRowsValues } = require("../General");

function getTitlesToSheetGeneral() {
  return [
    "Número Comprobante",
    "Fecha",
    "Hora",
    "Cuenta de destino",
    "Monto enviado",
    "Monto",
    "Moneda",
    "Tipo de cambio",
    "Estado",
    "Imagen",
  ];
}

async function getArrayToSheetGeneral(cliente) {
  const values = [
    cliente.numero_comprobante,
    cliente.fecha,
    cliente.hora,
    cliente.destino,
    cliente.montoEnviado,
    cliente.monto,
    cliente.moneda,
    cliente.tipoDeCambio,
    cliente.estado,
    cliente.imagen ?? "",
  ];
  return values;
}

async function parseClientes(arr) {
  const clientes = arr.map((row) => ({
    nombre: row[0],
    descuento: row[1],
    ccActivas: row[2]
      ? row[2].split(", ").filter((cc) => cc.trim() !== "")
      : [],
  }));
  return clientes;
}

async function getClientesFromSheet(GOOGLE_SHEET_ID) {
  const data = await getRowsValues(GOOGLE_SHEET_ID, "ClientesRAW", "A2:A1000");
  res = data.map((row) => row[0]);
  return res;
}

async function addClienteComprobanteToSheet(cliente, GOOGLE_SHEET_ID) {
  const headers = getTitlesToSheetGeneral();
  const values = await getArrayToSheetGeneral(cliente);
  await addRow(
    GOOGLE_SHEET_ID,
    values,
    `${cliente.cliente}!A1:Z10000`,
    headers
  );
}

async function updateClienteStatus(cliente, GOOGLE_SHEET_ID) {
  const values = await getArrayToSheetGeneral(cliente);

  await updateRow(GOOGLE_SHEET_ID, values, general_range, 2, cliente.cuit);
}

module.exports = {
  getClientesFromSheet,
  addClienteComprobanteToSheet,
  updateClienteStatus,
};

const general_range = "ClientesRAW!A1:Z10000";
const GOOGLE_SHEET_CLIENTS_ID = process.env.GOOGLE_SHEET_CLIENTS_ID;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const { addRow, updateRow, getRowsValues } = require("../General");

function getTitlesToSheetGeneral() {
  return [
    "Número Comprobante",
    "Fecha",
    "Hora",
    "Cuenta de origen",
    "Cuenta de destino",
    "CUIT",
    "Monto enviado",
    "Monto",
    "Moneda",
    "Estado",
    "Imagen",
  ];
}

async function getArrayToSheetGeneral(cliente) {
  const values = [
    cliente.numero_comprobante,
    cliente.fecha,
    cliente.hora,
    `${cliente.nombre} ${cliente.apellido}`,
    cliente.destino,
    cliente.cuit,
    cliente.montoEnviado,
    cliente.monto,
    cliente.moneda,
    cliente.estado,
    cliente.imagen ?? "",
  ];
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

async function addClienteComprobanteToSheet(cliente) {
  const headers = getTitlesToSheetGeneral();
  const values = await getArrayToSheetGeneral(cliente);
  await addRow(
    GOOGLE_SHEET_ID,
    values,
    `${cliente.cliente}!A1:Z10000`,
    headers
  );
}

async function updateClienteStatus(cliente) {
  const values = await getArrayToSheetGeneral(cliente);

  await updateRow(GOOGLE_SHEET_ID, values, general_range, 2, cliente.cuit);
}

module.exports = {
  getClientesFromSheet,
  addClienteComprobanteToSheet,
  updateClienteStatus,
};

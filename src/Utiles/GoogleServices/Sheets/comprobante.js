const general_range = "ComprobanteRAW!A1:Z1000";
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const { addRow } = require("../General");

async function getArrayToSheetGeneral(comprobante) {
  const values = [
    comprobante.numero_comprobante,
    comprobante.fecha,
    comprobante.hora,
    `${comprobante.nombre} ${comprobante.apellido}`,
    comprobante.cuit,
    comprobante.dni,
    comprobante.monto,
    comprobante.estado,
    "ACTIVE", // Estado para el registro en Sheets
    comprobante.imagen ?? "",
  ];
  return values;
}

function getTitlesToSheetGeneral() {
  return [
    "Número Comprobante",
    "Fecha",
    "Hora",
    "Nombre",
    "CUIT",
    "DNI",
    "Monto",
    "Estado",
    "Status",
    "Imagen",
  ];
}

async function addComprobanteToSheet(comprobante) {
  console.log(comprobante);
  const values = await getArrayToSheetGeneral(comprobante);
  console.log(values);
  await addRow(GOOGLE_SHEET_ID, values, general_range);
}

module.exports = {
  addComprobanteToSheet,
};

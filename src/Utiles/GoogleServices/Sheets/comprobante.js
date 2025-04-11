const general_range = "ComprobanteRAW!A1:Z1000";
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const { addRow } = require("../General");

async function getArrayToSheetGeneral(comprobante) {
  const values = [
    comprobante.numero_comprobante,
    comprobante.fecha,
    comprobante.hora,
    comprobante.cliente,
    `${comprobante.nombre} ${comprobante.apellido}`,
    comprobante.destino,
    comprobante.cuit,
    comprobante.montoEnviado,
    comprobante.monto,
    comprobante.moneda,
    comprobante.estado,
    comprobante.imagen ?? "",
  ];
  return values;
}

function getTitlesToSheetGeneral() {
  return [
    "Número Comprobante",
    "Fecha",
    "Hora",
    "Cliente",
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

async function addComprobanteToSheet(comprobante) {
  const headers = getTitlesToSheetGeneral();
  const values = await getArrayToSheetGeneral(comprobante);
  console.log(values);
  await addRow(GOOGLE_SHEET_ID, values, general_range, headers);
}

module.exports = {
  addComprobanteToSheet,
};

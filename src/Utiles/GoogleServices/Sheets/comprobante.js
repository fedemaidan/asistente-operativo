const general_range = "ComprobanteRAW!A1:Z1000";
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const { addRow, updateRow } = require("../General");

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
    comprobante.tipoDeCambio,
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
    "Tipo de cambio",
    "Estado",
    "Imagen",
  ];
}

async function addComprobanteToSheet(comprobante) {
  const headers = getTitlesToSheetGeneral();
  const values = await getArrayToSheetGeneral(comprobante);
  await addRow(GOOGLE_SHEET_ID, values, general_range, headers);
}

async function updateComprobanteToSheet(matchs) {
  for (const match of matchs) {
    if (
      Math.round(match.comprobante.montoEnviado) ==
      Math.round(match.movimiento.importe)
    ) {
      match.comprobante.estado = "CONFIRMADO";
    } else {
      match.comprobante.estado = "REVISAR MONTO";
    }
    match.comprobante.nombre = match.comprobante.cuentaOrigen.split(" ")[0];
    match.comprobante.apellido = match.comprobante.cuentaOrigen.split(" ")[1];
    console.log("match", match);

    let values = await getArrayToSheetGeneral(match.comprobante);

    await updateRow(
      GOOGLE_SHEET_ID,
      values,
      general_range,
      0,
      match.comprobante.numero_comprobante
    );
  }
}

module.exports = {
  addComprobanteToSheet,
  updateComprobanteToSheet,
};

const general_range = "ComprobanteRAW!A1:Z1000";
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const { addRow, updateRow } = require("../General");

async function getArrayToSheetGeneral(comprobante) {
  const values = [
    comprobante.numero_comprobante,
    comprobante.fecha,
    comprobante.hora,
    comprobante.cliente,
    comprobante.destino,
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
    "Cuenta de destino",
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

    console.log("DESTINO", match.comprobante.destino);

    let values = await getArrayToSheetGeneral(match.comprobante);
    console.log("VALUES", values);
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

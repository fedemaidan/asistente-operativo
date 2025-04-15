const { getRowsValues } = require("../GoogleServices/General");
const {
  updateComprobanteToSheet,
} = require("../GoogleServices/Sheets/comprobante");

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

const parseMovimientos = (arr) =>
  arr.map((row) => ({
    sucOrigen: row["__EMPTY"],
    descSucursal: row["__EMPTY_1"],
    codOperativo: row["__EMPTY_2"],
    referencia: row["__EMPTY_3"],
    concepto: row["__EMPTY_4"],
    importe: row["__EMPTY_5"],
    saldo: row["__EMPTY_6"],
  }));

const parseComprobantes = (arr) =>
  arr.map((row) => ({
    numero_comprobante: row[0],
    fecha: row[1],
    hora: row[2],
    cliente: row[3],
    destino: row[4],
    montoEnviado: row[5],
    monto: row[6],
    moneda: row[7],
    tipoDeCambio: row[8],
    estado: row[9],
    imagen: row[10],
  }));

module.exports = async function analizarExcel(data, sender, sock) {
  const limiteIndex = data.findIndex((row) =>
    Object.values(row).some(
      (value) => typeof value === "string" && value == "Últimos Movimientos"
    )
  );
  //const movimientosDelDia = parseMovimientos(data.slice(0, limiteIndex - 1));
  const ultimosMovimientos = parseMovimientos(data.slice(limiteIndex + 3));

  const dataComprobantes = await getRowsValues(
    GOOGLE_SHEET_ID,
    "ComprobanteRAW",
    "A2:M1000"
  );

  //TODO: solo buscar match con los pendientes

  const comprobantesRAW = parseComprobantes(dataComprobantes);
  const matchs = [];
  for (const comprobante of comprobantesRAW) {
    for (const movimiento of ultimosMovimientos) {
      if (comprobante.numero_comprobante == movimiento.referencia) {
        matchs.push({
          comprobante,
          movimiento,
        });
        break;
      }
    }
  }

  if (matchs.length === 0) {
    await sock.sendMessage(sender, {
      text: "❌ No se encontraron comprobantes que coincidan con las referencias del archivo Excel.",
    });
    return;
  }

  const mensajeExito = `✅ *Procesamiento completado*\n\n📊 Se encontraron ${
    matchs.length
  } ${
    matchs.length === 1 ? "comprobante " : "comprobantes "
  }en el archivo Excel.`;

  sock.sendMessage(sender, {
    text: mensajeExito,
  });

  await updateComprobanteToSheet(matchs);
  await sock.sendMessage(sender, {
    text: `✅ Comprobantes actualizados en la hoja de cálculo. Link al Google Sheet: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit?usp=sharing`,
  });
};

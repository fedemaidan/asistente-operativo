const { getRowsValues } = require("../General");

// Igual que en entrega.js
const parseMoney = (val) => {
  if (typeof val === "number") return val;
  if (!val || val === "-") return 0;
  const isNegative = String(val).includes("-");
  const cleaned = String(val)
    .replace(/\$/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/\s/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return isNegative ? -Math.abs(num) : Math.abs(num);
};

const parsePagos = (arr) => {
  const pagos = arr.map((row) => ({
    type: "EGRESO",
    empresaId: "celulandia",
    moneda: row[7],
    total: {
      ars: parseMoney(row[19]),
      usdOficial: parseMoney(row[20]),
      usdBlue: parseMoney(row[20]),
      concepto: row[3],
      caja: row[4],
    },
    usuario: "SISTEMA MIGRACION PAGOS",
    tipoDeCambio: row[8],
    fecha: row[1],
    hora: row[2],
  }));

  return pagos;
};

async function getPagosFromSheet(GOOGLE_SHEET_ID) {
  const dataPagos = await getRowsValues(
    GOOGLE_SHEET_ID,
    "PagosRAW",
    "A2:W100000"
  );
  const pagosRAW = parsePagos(dataPagos);
  return pagosRAW;
}

module.exports = {
  parsePagos,
  getPagosFromSheet,
};

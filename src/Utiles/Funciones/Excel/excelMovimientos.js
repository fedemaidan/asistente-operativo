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

const parseJsonBancoToInfo = (data) => {
  const dataArray = Array.isArray(data) ? data : Object.values(data);

  const limiteIndex = dataArray.findIndex((row) =>
    Object.values(row).some(
      (value) => typeof value === "string" && value == "Últimos Movimientos"
    )
  );

  const movimientosDelDia = parseMovimientos(
    dataArray.slice(0, limiteIndex - 1)
  );
  const ultimosMovimientos = parseMovimientos(dataArray.slice(limiteIndex + 3));

  return [...movimientosDelDia, ...ultimosMovimientos];
};

//matchGenerico para banco y financiera ??
const getMatchs = (comprobanteSheet, comprobanteMovimientos) => {
  const matchs = [];
  for (const comprobante of comprobanteSheet) {
    for (const movimiento of comprobanteMovimientos) {
      if (comprobante.numero_comprobante == movimiento.referencia) {
        matchs.push({
          comprobante,
          movimiento,
        });
        break;
      }
    }
  }
  return matchs;
};

module.exports = {
  parseMovimientos,
  parseJsonBancoToInfo,
  getMatchs,
};

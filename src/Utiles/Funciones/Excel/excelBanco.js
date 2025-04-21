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

const parseJsonToInfoBanco = (data) => {
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

const getBancoMatchs = (comprobanteSheet, comprobanteBanco) => {
  const matchs = [];
  for (const comprobante of comprobanteSheet) {
    for (const movimiento of comprobanteBanco) {
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
  parseComprobantes,
  parseJsonToInfoBanco,
  getBancoMatchs,
};

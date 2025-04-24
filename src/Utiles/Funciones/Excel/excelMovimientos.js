const { getDaysDiff } = require("../HandleDates");

const parseMovimientosBanco = (arr) => {
  return arr
    .map((row) => ({
      sucOrigen: row["__EMPTY"],
      descSucursal: row["__EMPTY_1"],
      codOperativo: row["__EMPTY_2"],
      referencia: row["__EMPTY_3"],
      concepto: row["__EMPTY_4"],
      importe: row["__EMPTY_5"],
      saldo: row["__EMPTY_6"],
    }))
    .filter(
      (mov) =>
        mov.referencia !== undefined &&
        mov.importe !== undefined &&
        mov.referencia !== "Referencia" &&
        !isNaN(Number(mov.importe))
    );
};

const parseJsonBancoToMovimiento = (data) => {
  const dataArray = Array.isArray(data) ? data : Object.values(data);

  const limiteIndex = dataArray.findIndex((row) =>
    Object.values(row).some(
      (value) => typeof value === "string" && value == "Últimos Movimientos"
    )
  );

  const movimientosDelDia = parseMovimientosBanco(
    dataArray.slice(0, limiteIndex - 1)
  );

  const ultimosMovimientos = parseMovimientosBanco(
    dataArray.slice(limiteIndex + 3)
  );

  const resultado = [...movimientosDelDia, ...ultimosMovimientos];
  return resultado;
};

const parseJsonFinancieraToMovimiento = (data) => {
  const dataArray = Array.isArray(data) ? data : Object.values(data);

  const infoMovimientos = dataArray
    .filter((value) => value.textoAgrupa === "Ingreso. TT")
    .map((value) => ({
      importe: value.credito,
      fecha: value.diaCrea,
      hora: value.horaCrea,
    }));

  return infoMovimientos;
};

const getMatchs = (comprobanteSheet, comprobanteMovimientos) => {
  const matchs = [];

  // Buscar matchs con movimientos Banco (por id de referencia)
  if (comprobanteMovimientos[0]?.referencia) {
    for (const comprobante of comprobanteSheet) {
      for (const movimiento of comprobanteMovimientos) {
        if (comprobante.numero_comprobante == movimiento.referencia) {
          // Para banco, solo marcar como CONFIRMADO
          comprobante.estado =
            Math.round(Number(comprobante.montoEnviado)) ==
            Math.round(Number(movimiento.importe))
              ? "CONFIRMADO"
              : "REVISAR MONTO";
          matchs.push({
            comprobante,
            movimiento,
          });
          break;
        }
      }
    }
  }

  console.log("COMPROBANTESHEET", comprobanteSheet);
  console.log("COMPROBANTEMOVIMIENTOS", comprobanteMovimientos);
  // Buscar matchs con movimientos Financiera (por monto y fecha con diferencia máxima de 7 días)
  if (comprobanteMovimientos[0]?.fecha) {
    for (const comprobante of comprobanteSheet) {
      const montoComprobante = Number(comprobante.montoEnviado);
      for (const movimiento of comprobanteMovimientos) {
        const montoMovimiento = Number(movimiento.importe);
        console.log("MONTOCOMPROBANTE Y MONTOMOVIMIENTO", {
          montoComprobante,
          montoMovimiento,
        });
        const diffDays = getDaysDiff(comprobante.fecha, movimiento.fecha);
        if (
          montoComprobante == montoMovimiento &&
          diffDays < 7 &&
          diffDays >= 0
        ) {
          comprobante.estado = `CONFIRMADO ${diffDays}`;

          matchs.push({
            comprobante,
            movimiento,
            diffDays,
          });
          break;
        }
      }
    }
  }

  return matchs;
};

module.exports = {
  parseJsonBancoToMovimiento,
  parseJsonFinancieraToMovimiento,
  getMatchs,
};

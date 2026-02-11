const { getDaysDiff } = require("../HandleDates");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
dayjs.extend(customParseFormat);

function parseExcelDate(value) {
  console.log("valueExcelDate", value);
  if (!value) return null;

  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + value * 86400000);
  }

  if (typeof value === "string") {
    const formats = [
      "DD/MM/YYYY",
      "D/M/YYYY",
      "MM/DD/YYYY",
      "M/D/YYYY",
      "YYYY-MM-DD",
      "DD-MM-YYYY",
      "D MMM YYYY",
      "MMM D, YYYY",
      "DD.MM.YYYY",
    ];
    for (const format of formats) {
      const date = dayjs(value, format, true); // true = strict parsing
      if (date.isValid()) return date.toDate();
    }
  }

  return null;
}

const parseComprobantesJson = (arr) => {
  return arr.map((comprobante) => {
    return comprobante;
  });
};

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
      caja: "ENSHOP SRL",
    }))
    .filter(
      (mov) =>
        mov.referencia !== undefined &&
        mov.importe !== undefined &&
        mov.referencia !== "Referencia" &&
        !isNaN(Number(mov.importe))
    );
};

function parseImporte(importe) {
  if (typeof importe === "number") {
    const str = importe.toString();
    if (importe < 1000 && str.includes(".")) {
      const partes = str.split(".");
      if (partes.length === 2 && partes[1].length > 2) {
        return parseFloat(
          partes[0] + partes[1].slice(0, 3) + "." + partes[1].slice(3)
        );
      }
    }
    return importe;
  }
  if (typeof importe === "string") {
    let limpio = importe.trim();
    let negativo = false;
    if (limpio.startsWith("(") && limpio.endsWith(")")) {
      negativo = true;
      limpio = limpio.slice(1, -1);
    }
    limpio = limpio.replace(/\./g, "").replace(",", ".");
    const valor = parseFloat(limpio);
    if (isNaN(valor)) return 0;
    return negativo ? -valor : valor;
  }
  return 0;
}

const parseMovimientosBancoXls = (arr) => {
  console.log("XLS ARCHIVO", arr);

  return arr
    .map((row) => {
      const nuevaFecha = parseExcelDate(row["Movimientos del Día"]);
      const importeStr = row["__EMPTY_5"];
      const saldoStr = row["__EMPTY_6"];
      const importeFinal = parseImporte(importeStr);
      const saldoFinal =
        saldoStr !== undefined && saldoStr !== null && saldoStr !== ""
          ? parseImporte(saldoStr)
          : undefined;
      return {
        fecha: nuevaFecha,
        sucOrigen: row["__EMPTY"],
        descSucursal: row["__EMPTY_1"],
        codOperativo: row["__EMPTY_2"],
        referencia: row["__EMPTY_3"],
        concepto: row["__EMPTY_4"],
        importe: importeFinal,
        saldo: saldoFinal,
        caja: "ENSHOP SRL",
      };
    })
    .filter(
      (mov) =>
        mov.fecha instanceof Date &&
        !isNaN(mov.fecha.getTime()) &&
        mov.referencia &&
        mov.referencia !== "Referencia"
    );
};

const parseJsonBancoToMovimiento = (data, fileName) => {
  console.log("dataBanco", data);
  const dataArray = Array.isArray(data) ? data : Object.values(data);

  const limiteIndex = dataArray.findIndex((row) =>
    Object.values(row).some(
      (value) => typeof value === "string" && value == "Últimos Movimientos"
    )
  );

  let movimientosDelDia = [];
  let ultimosMovimientos = [];

  if (fileName.endsWith(".xls")) {
    movimientosDelDia = parseMovimientosBancoXls(
      dataArray.slice(0, limiteIndex - 1)
    );

    ultimosMovimientos = parseMovimientosBancoXls(
      dataArray.slice(limiteIndex + 3)
    );
  } else {
    movimientosDelDia = parseMovimientosBanco(
      dataArray.slice(0, limiteIndex - 1)
    );

    ultimosMovimientos = parseMovimientosBanco(
      dataArray.slice(limiteIndex + 3)
    );
  }

  const resultado = [...movimientosDelDia, ...ultimosMovimientos];
  return resultado;
};

const parseJsonFinancieraToMovimiento = (data) => {
  console.log("DATAJSON", data);
  const dataArray = Array.isArray(data) ? data : Object.values(data);

  const infoMovimientos = dataArray
    .filter((value) => value.textoAgrupa === "Ingreso. TT")
    .map((value) => ({
      importe: value.credito,
      fecha: value.diaCrea,
      hora: value.horaCrea,
      caja: "ASOCIACION CONSULTORA MUTUAL",
    }));

  return infoMovimientos;
};

const parseNewJsonFinancieraToMovimiento = (data) => {
  const dataArray = Array.isArray(data) ? data : Object.values(data);
  console.log("dataArray", dataArray.slice(0, 30));
  return dataArray
    .map((value) => {
      const importeNumber = parseImporte(value.__EMPTY_3);
      return {
        importe: Math.round(importeNumber),
        fecha: value.__EMPTY_2,
        caja: "SERCOB SA",
      };
    })
    .filter((mov) => mov.importe > 0);
};

const getMatchs = (comprobanteSheet, comprobanteMovimientos) => {
  const matchs = [];
  const comprobantesFiltrados = comprobanteSheet.filter(
    (comprobante) => comprobante.estado == "PENDIENTE"
  );

  const comprobantesParseados = parseComprobantesJson(comprobantesFiltrados);

  for (const comprobante of comprobantesParseados) {
    for (const movimiento of comprobanteMovimientos) {
      let montoComprobante = Math.round(Number(comprobante.montoEnviado));
      let montoMovimiento = Math.round(Number(movimiento.importe));
      if (
        movimiento.referencia &&
        comprobante.numero_comprobante == movimiento.referencia
      ) {
        comprobante.estado =
          montoComprobante == montoMovimiento ? "CONFIRMADO" : "REVISAR MONTO";
        matchs.push({
          comprobante,
          movimiento,
        });
        break;
      } else if (montoComprobante == montoMovimiento) {
        // Verificar si existe fecha en el movimiento
        if (movimiento.fecha) {
          const diffDays = getDaysDiff(
            comprobante.fecha,
            movimiento.fecha,
            montoComprobante,
            montoMovimiento
          );
          if (diffDays < 5 && diffDays >= 0) {
            console.log("diffDays", diffDays);
            console.log("comprobanteMatch", comprobante);
            console.log("movimientoMatch", movimiento);
            comprobante.estado = `CONFIRMADO`;
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
  }

  return matchs;
};

module.exports = {
  parseJsonBancoToMovimiento,
  parseNewJsonFinancieraToMovimiento,
  parseJsonFinancieraToMovimiento,
  getMatchs,
};

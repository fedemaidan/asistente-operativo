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
    // Procesar el monto: remover '$' y puntos, luego convertir a número
    const montoLimpio = comprobante.montoEnviado
      .replace("$", "")
      .replace(/\./g, "")
      .trim();

    return {
      ...comprobante,
      montoEnviado: parseInt(montoLimpio),
    };
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
    // Si el número es menor a 1000 y tiene decimales largos, probablemente es un error de parseo
    const str = importe.toString();
    if (importe < 1000 && str.includes(".")) {
      // Intenta reconstruir el número como si fuera miles
      // Ejemplo: 162.27273 -> 162272.73
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
    let limpio = importe.replace(/\./g, "").replace(",", ".");
    let valor = parseFloat(limpio);
    return isNaN(valor) ? 0 : valor;
  }
  return 0;
}

const parseMovimientosBancoXls = (arr) => {
  console.log("XLS ARCHIVO", arr);

  return arr.map((row) => {
    const nuevaFecha = parseExcelDate(row["__EMPTY"]);
    const importeStr = row["__EMPTY_6"];
    const saldoStr = row["__EMPTY_7"];
    const importeFinal = parseImporte(importeStr);
    const saldoFinal = saldoStr ? parseImporte(saldoStr) : saldoStr;
    return {
      fecha: nuevaFecha,
      sucOrigen: row["__EMPTY_1"],
      descSucursal: row["__EMPTY_2"],
      codOperativo: row["__EMPTY_3"],
      referencia: row["__EMPTY_4"],
      concepto: row["__EMPTY_5"],
      importe: importeFinal,
      saldo: saldoFinal,
    };
  });
};

const parseJsonBancoToMovimiento = (data, fileName) => {
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
  const comprobantesFiltrados = comprobanteSheet.filter(
    (comprobante) => comprobante.estado == "PENDIENTE"
  );

  const comprobantesParseados = parseComprobantesJson(comprobantesFiltrados);
  console.log("comprobantesParseados", comprobantesParseados);
  console.log("comprobanteMovimientos", comprobanteMovimientos);

  for (const comprobante of comprobantesParseados) {
    for (const movimiento of comprobanteMovimientos) {
      let montoComprobante = Math.round(Number(comprobante.montoEnviado));
      let montoMovimiento = Math.round(Number(movimiento.importe));
      if (
        movimiento.referencia &&
        comprobante.numero_comprobante == movimiento.referencia
      ) {
        comprobante.estado =
          montoComprobante == montoMovimiento
            ? "CONFIRMADO REF"
            : "REVISAR MONTO";
        matchs.push({
          comprobante,
          movimiento,
        });
        break;
      } else if (montoComprobante == montoMovimiento) {
        // Verificar si existe fecha en el movimiento
        if (movimiento.fecha) {
          const diffDays = getDaysDiff(comprobante.fecha, movimiento.fecha);
          console.log("diffDays", diffDays);
          console.log("comprobanteMatch", comprobante);
          console.log("movimientoMatch", movimiento);
          if (diffDays < 10 && diffDays >= 0) {
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
  }

  return matchs;
};

module.exports = {
  parseJsonBancoToMovimiento,
  parseJsonFinancieraToMovimiento,
  getMatchs,
};

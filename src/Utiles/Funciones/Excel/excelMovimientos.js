const { getDaysDiff } = require("../HandleDates");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
dayjs.extend(customParseFormat);

function parseExcelDate(value) {
  if (!value) return null;

  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + value * 86400000);
  }

  if (typeof value === "string") {
    const formats = [
      "YYYY-MM-DD",
      "DD/MM/YYYY",
      "MM/DD/YYYY",
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

const parseMovimientosBancoXls = (arr) => {
  console.log("XLS ARCHIVO", arr);

  return arr.map((row) => {
    const nuevaFecha = parseExcelDate(row["__EMPTY"]);
    const importeStr = row["__EMPTY_6"];
    let importeFinal = 0;
    if (importeStr && typeof importeStr === "string") {
      const importe = importeStr.replace(/\./g, "").replace(",", ".");
      importeFinal = parseFloat(importe);
    } else if (importeStr) {
      importeFinal = Math.round(Number(importeStr));
    }

    //funcion fecha parse a Date
    return {
      fecha: nuevaFecha,
      sucOrigen: row["__EMPTY_1"],
      descSucursal: row["__EMPTY_2"],
      codOperativo: row["__EMPTY_3"],
      referencia: row["__EMPTY_4"],
      concepto: row["__EMPTY_5"],
      importe: importeFinal,
      saldo: row["__EMPTY_7"],
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

  for (const comprobante of comprobantesFiltrados) {
    for (const movimiento of comprobanteMovimientos) {
      let montoComprobante = Math.round(Number(comprobante.montoEnviado));
      let montoMovimiento = Math.round(Number(movimiento.importe));

      if (
        movimiento.referencia &&
        comprobante.numero_comprobante == movimiento.referencia
      ) {
        console.log("MATCH ENCONTRADO", comprobante, movimiento);
        comprobante.estado =
          montoComprobante == montoMovimiento ? "CONFIRMADO" : "REVISAR MONTO";
        matchs.push({
          comprobante,
          movimiento,
        });
        break;
      } else if (montoComprobante == montoMovimiento) {
        console.log("MATCH ENCONTRADO", comprobante, movimiento);
        // Verificar si existe fecha en el movimiento
        if (movimiento.fecha) {
          const diffDays = getDaysDiff(comprobante.fecha, movimiento.fecha);

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

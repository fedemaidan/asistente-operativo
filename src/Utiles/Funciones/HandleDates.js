const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
dayjs.extend(customParseFormat);

const getDaysDiff = (comprobanteFechaStr, movimientoFechaSerial) => {
  const formatos = ["DD/MM/YYYY", "D/M/YYYY", "MM/DD/YYYY", "M/D/YYYY"];
  let movimientoDate;

  console.log(
    "getDaysDiff -> comprobanteFechaStr:",
    comprobanteFechaStr,
    "movimientoFechaSerial:",
    movimientoFechaSerial
  );

  if (
    typeof movimientoFechaSerial === "number" &&
    Number.isInteger(movimientoFechaSerial)
  ) {
    movimientoDate = new Date((movimientoFechaSerial - 25569) * 86400 * 1000);
  } else if (
    typeof movimientoFechaSerial === "string" &&
    movimientoFechaSerial.includes("/")
  ) {
    const [movDay, movMonth, movYear] = movimientoFechaSerial
      .split("/")
      .map(Number);
    movimientoDate = new Date(movYear, movMonth - 1, movDay);
  } else if (movimientoFechaSerial instanceof Date) {
    movimientoDate = movimientoFechaSerial;
  } else {
    return null;
  }

  let mejorDiff = null;
  for (const formato of formatos) {
    const comprobanteDate = dayjs(comprobanteFechaStr, formato, true).toDate();
    if (isNaN(comprobanteDate)) continue;
    const diferenciaMs = movimientoDate - comprobanteDate;
    const diferenciaDias = Math.round(diferenciaMs / (1000 * 60 * 60 * 24));
    if (diferenciaDias < 10 && diferenciaDias >= 0) {
      return diferenciaDias;
    }
    if (mejorDiff === null || Math.abs(diferenciaDias) < Math.abs(mejorDiff)) {
      mejorDiff = diferenciaDias;
    }
  }
  return mejorDiff;
};

module.exports = {
  getDaysDiff,
};

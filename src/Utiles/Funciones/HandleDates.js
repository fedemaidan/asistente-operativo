const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
dayjs.extend(customParseFormat);

const getDaysDiff = (
  comprobanteFechaStr,
  movimientoFechaSerial,
  montoComprobante,
  montoMovimiento
) => {
  const formatos = ["DD/MM/YYYY", "D/M/YYYY", "MM/DD/YYYY", "M/D/YYYY"];
  let movimientoDate;

  console.log(
    "getDaysDiff -> comprobanteFechaStr:",
    comprobanteFechaStr,
    "movimientoFechaSerial:",
    movimientoFechaSerial,
    "montoComprobante:",
    montoComprobante,
    "montoMovimiento:",
    montoMovimiento
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

// Función para obtener la fecha actual en horario argentino
const getFechaArgentina = () => {
  return new Date().toLocaleString("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
};

// Función para convertir una fecha a horario argentino
const convertirAHorarioArgentina = (fecha) => {
  if (!fecha) return fecha;
  return new Date(fecha).toLocaleString("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
};

// Función para obtener solo la fecha en formato YYYY-MM-DD en horario argentino
const getFechaArgentinaFormato = () => {
  const fecha = new Date();
  return fecha.toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
};

// Función para obtener solo la hora en formato HH:MM en horario argentino
const getHoraArgentinaFormato = () => {
  const fecha = new Date();
  return fecha.toLocaleTimeString("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateToDDMMYYYY = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};



module.exports = {
  getDaysDiff,
  getFechaArgentina,
  convertirAHorarioArgentina,
  getFechaArgentinaFormato,
  getHoraArgentinaFormato,
  formatDateToDDMMYYYY,
};

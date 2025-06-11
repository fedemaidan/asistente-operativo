const getDaysDiff = (comprobanteFechaStr, movimientoFechaSerial) => {
  console.log("FECHITA", comprobanteFechaStr, movimientoFechaSerial);

  // Parsear fecha del comprobante (formato DD/MM/YYYY)
  const [day, month, year] = comprobanteFechaStr.split("/").map(Number);
  const comprobanteDate = new Date(year, month - 1, day);

  let movimientoDate;

  // Manejar diferentes tipos de entrada para movimientoFechaSerial
  if (
    typeof movimientoFechaSerial === "number" &&
    Number.isInteger(movimientoFechaSerial)
  ) {
    // Es un entero: usar formato Excel (número serial)
    console.log(
      "Procesando fecha como número de Excel:",
      movimientoFechaSerial
    );
    movimientoDate = new Date((movimientoFechaSerial - 25569) * 86400 * 1000);
  } else if (
    typeof movimientoFechaSerial === "string" &&
    movimientoFechaSerial.includes("/")
  ) {
    // Es un string: usar formato DD/MM/YYYY
    console.log(
      "Procesando fecha como string DD/MM/YYYY:",
      movimientoFechaSerial
    );
    const [movDay, movMonth, movYear] = movimientoFechaSerial
      .split("/")
      .map(Number);
    movimientoDate = new Date(movYear, movMonth - 1, movDay);
  } else if (movimientoFechaSerial instanceof Date) {
    // Ya es un objeto Date
    console.log("Fecha ya es un objeto Date:", movimientoFechaSerial);
    movimientoDate = movimientoFechaSerial;
  } else {
    console.warn(
      "Formato de fecha de movimiento no reconocido:",
      movimientoFechaSerial,
      "Tipo:",
      typeof movimientoFechaSerial
    );
    return null;
  }

  console.log("FECHA MOVIMIENTO", movimientoDate);
  console.log("FECHA COMPROBANTE", comprobanteDate);

  const diferenciaMs = movimientoDate - comprobanteDate;
  const diferenciaDias = Math.round(diferenciaMs / (1000 * 60 * 60 * 24));

  return diferenciaDias;
};

module.exports = {
  getDaysDiff,
};

const getDaysDiff = (comprobanteFechaStr, movimientoFechaSerial) => {
  console.log();
  const [day, month, year] = comprobanteFechaStr.split("/").map(Number);
  const comprobanteDate = new Date(year, month - 1, day);
  const movimientoDate = new Date(
    (movimientoFechaSerial - 25569) * 86400 * 1000
  );

  console.log("FECHA MOVIMIENTO", new Date(movimientoDate));
  console.log("FECHA COMPROBANTE", new Date(comprobanteDate));
  const diferenciaMs = movimientoDate - comprobanteDate;
  const diferenciaDias = Math.round(diferenciaMs / (1000 * 60 * 60 * 24));

  return diferenciaDias;
};

module.exports = {
  getDaysDiff,
};

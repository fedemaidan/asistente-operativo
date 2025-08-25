const { getRowsValues } = require("../General");

const parseEntregas = (arr) => {
  console.log("parseEntregas", arr);
  const parseMoney = (val) => {
    if (typeof val === "number") return val;
    if (!val || val === "-") return 0;
    const isNegative = String(val).includes("-");
    const cleaned = String(val)
      .replace(/\$/g, "")
      .replace(/\./g, "")
      .replace(/,/g, ".")
      .replace(/\s/g, "");
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return isNegative ? -Math.abs(num) : Math.abs(num);
  };

  const entregas = arr.map((row) => {
    const numeroEntrega = row[0];
    const fecha = row[1];
    const hora = row[2];
    const cliente = row[3];
    const montoEnviadoRaw = parseMoney(row[5]);
    const montoCCRaw = parseMoney(row[6]);
    const cc = row[7];
    const tc = parseFloat(row[8]) || 1;
    const monedaDePago = row[18];

    const posibleUsuario = row[11];
    const usuario =
      typeof posibleUsuario === "string" && posibleUsuario.includes("@")
        ? posibleUsuario
        : "Sistema";

    const montoEnviado = Math.abs(montoEnviadoRaw);
    const montoCC = Math.abs(montoCCRaw);

    const descuentoAplicado = montoEnviado > 0 ? montoCC / montoEnviado : 1;

    const tipoDeCambioFinal = tc;

    const subTotal = {
      ars: -(monedaDePago === "ARS"
        ? montoEnviado
        : Math.round(montoEnviado * tipoDeCambioFinal)),
      usdOficial: -(monedaDePago === "USD"
        ? montoEnviado
        : Math.round(montoEnviado / tipoDeCambioFinal)),
      usdBlue: -(monedaDePago === "USD"
        ? montoEnviado
        : Math.round(montoEnviado / tipoDeCambioFinal)),
    };

    const montoTotal = {
      ars: -(cc === "ARS" ? montoCC : Math.round(montoCC * tipoDeCambioFinal)),
      usdOficial: -(cc === "USD OFICIAL"
        ? montoCC
        : Math.round(montoCC / tipoDeCambioFinal)),
      usdBlue: -(cc === "USD BLUE"
        ? montoCC
        : Math.round(montoCC / tipoDeCambioFinal)),
    };

    return {
      descripcion: numeroEntrega || "",
      fechaCuenta: fecha,
      horaCuenta: hora,
      proveedorOCliente: cliente,
      descuentoAplicado,
      moneda: monedaDePago,
      cc,
      tipoDeCambio: tc,
      usuario,
      subTotal,
      montoTotal,
    };
  });
  return entregas;
};

async function getEntregasFromSheet(GOOGLE_SHEET_ID) {
  const dataEntregas = await getRowsValues(
    GOOGLE_SHEET_ID,
    "EntregasBase",
    "A2:W100000"
  );
  const entregasRAW = parseEntregas(dataEntregas);

  return entregasRAW;
}

module.exports = {
  parseEntregas,
  getEntregasFromSheet,
};

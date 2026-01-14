const cajaController = require("../../controllers/cajaController");
const {
  getFechaArgentina,
  getHoraArgentina,
} = require("../../controllers/clienteController");
const movimientoController = require("../../controllers/movimientoController");

async function getComprobantesFromMongo(cajaNombre) {
  console.log("cajaNombre", cajaNombre);
  const { data: caja, error: cajaError } = await cajaController.getByNombre(cajaNombre);
  console.log("caja", caja);
  
  if (cajaError || !caja) {
    throw new Error(`Caja "${cajaNombre}" no encontrada`);
  }
  
  const { data, error } = await movimientoController.getAll(
    {
      active: true,
      estado: "PENDIENTE",
      caja: caja._id,
      type: "INGRESO",
    },
    "caja",
    {
      sort: { fechaFactura: -1 },
      limit: 1000,
    }
  );
  console.log("dataMongo", data);
  if (error) {
    throw new Error(error);
  }
  return data.map((c) => {
    let montoEnviado = 0;
    switch (c.moneda) {
      case "ARS":
        montoEnviado = c.total.ars;
        break;
      case "USD":
        montoEnviado = c.total.usdBlue;
        break;
    }

    let montoCC = 0;
    switch (c.cuentaCorriente) {
      case "ARS":
        montoCC = c.total.ars;
        break;
      case "USD BLUE":
        montoCC = c.total.usdBlue;
        break;
      case "USD OFICIAL":
        montoCC = c.total.usdOficial;
        break;
    }

    console.log("fechaArgentina", getFechaArgentina(c.fechaFactura));
    console.log("horaArgentina", getHoraArgentina(c.fechaFactura));

    return {
      numero_comprobante: c.numeroFactura,
      fecha: getFechaArgentina(c.fechaFactura),
      hora: getHoraArgentina(c.fechaFactura),
      cliente: c.cliente.nombre,
      montoEnviado: montoEnviado,
      monto: montoCC,
      tipoDeCambio: c.tipoDeCambio,
      estado: c.estado,
      imagen: c.urlImagen,
      usuario: c.nombreUsuario,
      monedaDePago: c.moneda,
      id: c._id,
    };
  });
}

module.exports = {
  getComprobantesFromMongo,
};

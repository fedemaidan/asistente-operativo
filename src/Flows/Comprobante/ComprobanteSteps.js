const EnvioComprobante = require("./Envios/EnvioComprobante");
const ElegirCliente = require("./Envios/ElegirCliente");
const ValidacionDatos = require("./Envios/ValidacionDatos");
const ModificarDatos = require("./Envios/ModificarDatos");

const ComprobanteSteps = {
  EnvioComprobante,
  ElegirCliente,
  ValidacionDatos,
  ModificarDatos,
};
module.exports = { ComprobanteSteps };

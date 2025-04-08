const EnvioComprobante = require("./Envios/EnvioComprobante");
//const ValidacionComprobante = require("./Envios/ValidacionComprobante");
//const ModificarComprobante = require("./Envios/ModificarComprobante");
const ElegirCliente = require("./Envios/ElegirCliente1");
//const ValidacionCliente = require("./Envios/ValidacionCliente");
const ValidacionDatos = require("./Envios/ValidacionDatos");

const ComprobanteSteps = {
  EnvioComprobante,
  ElegirCliente,
  ValidacionDatos,
};
module.exports = { ComprobanteSteps };

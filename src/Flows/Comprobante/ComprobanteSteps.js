const EnvioComprobante = require("./Envios/EnvioComprobante");
const ValidacionComprobante = require("./Envios/ValidacionComprobante");
const ModificarComprobante = require("./Envios/ModificarComprobante");

const ComprobanteSteps = {
  EnvioComprobante,
  ValidacionComprobante,
  ModificarComprobante,
};
module.exports = { ComprobanteSteps };

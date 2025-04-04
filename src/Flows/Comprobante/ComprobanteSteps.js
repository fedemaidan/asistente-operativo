const EnvioComprobante = require("./Envios/EnvioComprobante");
const ValidacionComprobante = require("./Envios/ValidacionComprobante");
const ModificarComprobante = require("./Envios/ModificarComprobante");
const AgregarCliente = require("./Envios/AgregarCliente");

const ComprobanteSteps = {
  EnvioComprobante,
  ValidacionComprobante,
  ModificarComprobante,
  AgregarCliente,
};
module.exports = { ComprobanteSteps };

const EnvioComprobanteStep = require("./Steps/EnvioComprobanteStep");
const ElegirClienteStep = require("./Steps/ElegirClienteStep");
const ValidacionDatosStep = require("./Steps/ValidacionDatosStep");
const ModificarDatosStep = require("./Steps/ModificarDatosStep");

const ComprobanteSteps = {
  EnvioComprobanteStep,
  ElegirClienteStep,
  ValidacionDatosStep,
  ModificarDatosStep,
};
module.exports = { ComprobanteSteps };

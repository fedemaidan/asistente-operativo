const InicioVerificacionStep = require("./Steps/InicioVerificacionStep");
const ProcesarTelefonoStep = require("./Steps/ProcesarTelefonoStep");

const VerificarRemitenteSteps = {
  InicioVerificacionStep,
  ProcesarTelefonoStep,
};

module.exports = { VerificarRemitenteSteps };

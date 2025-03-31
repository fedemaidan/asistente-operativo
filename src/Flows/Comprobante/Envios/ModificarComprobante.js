const ModificarComprobante = require("../../../Utiles/Funciones/ModificarComprobante");
const flowManager = require("../../../FlowControl/FlowManager");

module.exports = async function ModificarComprobante(userId, message, sock) {
  const respuesta = await ModificarComprobante(userId, message);

  flowManager.setFlow(
    userId,
    "ENVIOCOMPROBANTE",
    "EnvioComprobante",
    respuesta
  );
};

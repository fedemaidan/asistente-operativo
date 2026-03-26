const FlowManager = require("../../../FlowControl/FlowManager");
const botSingleton = require("../../../Utiles/botSingleton");
const UsuarioBotService = require("../../../services/usuarioBotService");

const FLOW_NAME = "VERIFICAR_REMITENTE";
const STEP_NAME = "ProcesarTelefonoStep";

module.exports = async function ProcesarTelefonoStep(userId, message) {
  const sock = botSingleton.getSock();
  const localId = String(userId || "").split("@")[0];

  try {
    if (typeof message !== "string" || !String(message).trim()) {
      await sock.sendMessage(userId, {
        text: "Necesito el número en un mensaje de texto. Probá de nuevo.",
      });
      FlowManager.setFlow(userId, FLOW_NAME, STEP_NAME, {});
      return;
    }

    const service = new UsuarioBotService();
    const result = await service.crearVinculoRemitente(localId, message);

    if (!result.ok) {
      if (result.reason === "not_found") {
        await sock.sendMessage(userId, {
          text:
            "Ese número no está registrado en el sistema. No podés usar el bot con este chat.\n\n" +
            "Si fue un error, enviá de nuevo otro número (solo dígitos, como está dado de alta).",
        });
      } else if (result.reason === "invalid_input") {
        await sock.sendMessage(userId, {
          text: "No pude leer un número válido. Enviá solo dígitos (con código de país si corresponde).",
        });
      } else {
        await sock.sendMessage(userId, {
          text: "No se pudo completar la verificación. Intentá de nuevo con tu número registrado.",
        });
      }
      FlowManager.setFlow(userId, FLOW_NAME, STEP_NAME, {});
      return;
    }

    botSingleton.getUsers().set(localId, result.entry);
    FlowManager.resetFlow(userId);

    await sock.sendMessage(userId, {
      text: "Listo, quedó vinculado. Ya podés escribirme con normalidad.",
    });
  } catch (error) {
    console.error("ProcesarTelefonoStep:", error?.message || error);
    await sock.sendMessage(userId, {
      text: "Hubo un error al verificar. Intentá de nuevo en unos segundos.",
    });
    FlowManager.setFlow(userId, FLOW_NAME, STEP_NAME, {});
  }
};

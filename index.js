const connectToWhatsApp = require("./src/Utiles/Mensajes/whatsapp");
const getMessageType = require("./src/Utiles/Mensajes/GetType");
const messageResponder = require("./src/Utiles/Mensajes/messageResponder");
const botSingleton = require("./src/Utiles/botSingleton");
const users = require("./src/Utiles/Usuarios/usuariosMap");

const startBot = async () => {
  const sock = await connectToWhatsApp();

  await botSingleton.setSock(sock);
  botSingleton.setUsers(users);

  // Escucha mensajes entrantes
  sock.ev.on("messages.upsert", async (message) => {
    const msg = message.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;

    // Identificar el tipo de mensaje
    const messageType = getMessageType(msg.message);

    // Delegar manejo al messageResponder
    await messageResponder(messageType, msg, sender);
  });

  // Ejemplo de keep-alive
  setInterval(() => console.log("Keep-alive"), 5 * 60 * 1000);
  setInterval(
    async () => await sock.sendPresenceUpdate("available"),
    10 * 60 * 1000
  );
};

startBot();

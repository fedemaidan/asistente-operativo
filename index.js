const connectToWhatsApp = require("./src/Utiles/Mensajes/whatsapp");
// const getMessageType = require("./src/Utiles/Mensajes/GetType");
// const messageResponder = require("./src/Utiles/Mensajes/messageResponder");

const startBot = async () => {
  const sock = await connectToWhatsApp();

  // Ejemplo de keep-alive
  setInterval(() => console.log("Keep-alive"), 5 * 60 * 1000);
};

startBot();

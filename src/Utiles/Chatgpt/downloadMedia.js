const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");

module.exports = async function downloadMedia(message) {
  try {
    const messageType = message?.message?.imageMessage
      ? "image"
      : message?.message?.documentMessage
      ? "document"
      : message?.message?.audioMessage
      ? "audio"
      : null;

    if (!messageType) {
      throw new Error("No se encontró contenido multimedia en el mensaje.");
    }

    // Obtener el contenido multimedia
    const mediaContent = message.message[`${messageType}Message`];
    if (!mediaContent) {
      throw new Error("No se encontró contenido multimedia en el mensaje.");
    }

    const enrichedMessage = {
      key: message.key || {
        remoteJid: "unknown",
        id: "unknown",
        fromMe: false,
      },
      message: {
        [`${messageType}Message`]: mediaContent,
      },
    };

    // Descargar el contenido
    const buffer = await downloadMediaMessage(enrichedMessage, "buffer");

    // Obtener el nombre del archivo y su extensión
    let fileName = mediaContent.fileName || `${messageType}_${Date.now()}`;
    let ext = path.extname(fileName);

    // Si no tiene extensión, asignar una según el tipo de mensaje
    if (!ext) {
      ext =
        messageType === "image"
          ? ".jpeg"
          : messageType === "document"
          ? ".pdf" // Asumimos PDF si no tiene extensión
          : messageType === "audio"
          ? ".ogg"
          : ".bin"; // Si no se reconoce, se guarda como binario

      fileName += ext;
    }

    // Ruta donde se guardará el archivo
    const filePath = path.join(__dirname, "../downloads", fileName);
    // Crear directorio si no existe
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    // Guardar el archivo
    fs.writeFileSync(filePath, buffer);

    return filePath;
  } catch (error) {
    console.error("Error descargando contenido multimedia:", error.message);
    return null;
  }
};

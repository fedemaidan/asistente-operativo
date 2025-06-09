const FlowMapper = require("../../FlowControl/FlowMapper");
const downloadMedia = require("../Chatgpt/downloadMedia");
const ComprobanteFlow = require("../../Flows/Comprobante/ComprobanteFlow");
const transcribeImage = require("../Chatgpt/transcribeImage");
const { saveImageToStorage } = require("../Chatgpt/storageHandler");
const FlowManager = require("../../FlowControl/FlowManager");
const botSingleton = require("../botSingleton");

const messageResponder = async (messageType, msg, sender) => {
  //5493876147003@s.whatsapp.net
  //8767868768@g.us
  console.log("sender", sender);
  const phoneNumber = sender.split("@")[0];
  const sock = botSingleton.getSock();
  const users = botSingleton.getUsers();

  if (!users.has(phoneNumber)) {
    console.log(`Usuario ${phoneNumber} no encontrado en el mapa de usuarios.`);
    return;
  }

  const FlowMapper = users.get(phoneNumber).perfil.FlowMapper;

  switch (messageType) {
    case "text":
    case "text_extended": {
      const text =
        msg.message.conversation || msg.message.extendedTextMessage?.text;
      await FlowMapper.handleMessage(sender, text, messageType);

      break;
    }
    case "image": {
      try {
        await sock.sendMessage(sender, {
          text: "⏳ Analizando imagen... ⏳",
        });
        // Verificar si el mensaje tiene una imagen (no audio)
        if (!msg.message || !msg.message.imageMessage) {
          await sock.sendMessage(sender, {
            text: "❌ No se encontró una imagen en el mensaje.",
          });
          return;
        }

        const imageUrl = await saveImageToStorage(msg, sender);

        const transcripcion = await transcribeImage(imageUrl, phoneNumber);

        if (!transcripcion) {
          await sock.sendMessage(sender, {
            text: "⚠️ No pude extraer texto de la imagen.",
          });
          return;
        }

        const ComprobanteFlow = users.get(phoneNumber).perfil.ComprobanteFlow;

        ComprobanteFlow.start(
          sender,
          { ...transcripcion.data, imagen: imageUrl },
          sock
        );
      } catch (error) {
        console.error("Error al procesar la imagen:", error);
        await sock.sendMessage(sender, {
          text: "❌ Hubo un error al procesar tu imagen.",
        });
      }
      break;
    }
    case "video": {
      break;
    }
    case "audio": {
      try {
        await sock.sendMessage(sender, {
          text: "⏳ Escuchando tu mensaje... ⏳",
        });
        if (!msg.message || !msg.message.audioMessage) {
          await sock.sendMessage(sender, {
            text: "❌ No se encontró un audio en el mensaje.",
          });
          return;
        }

        // Pasar el mensaje completo
        const filePath = await downloadMedia(msg, "audio");

        const transcripcion = await transcribeAudio(filePath);

        console.log("Esta es la transcripcion");
        console.log(transcripcion);
        await FlowMapper.handleMessage(sender, transcripcion, messageType);
      } catch (error) {
        console.error("Error al procesar el audio:", error);
        await sock.sendMessage(sender, {
          text: "❌ Hubo un error al procesar tu audio.",
        });
      }
      break;
    }
    case "document":
    case "document-caption": {
      try {
        await sock.sendMessage(sender, {
          text: "⏳ Analizando archivo... ⏳",
        });
        let docMessage =
          msg.message.documentMessage ||
          msg.message.documentWithCaptionMessage?.message?.documentMessage;

        const mimetype = docMessage.mimetype;
        console.log("MimeType", mimetype); //application/pdf

        if (!docMessage) {
          console.error("❌ El mensaje no contiene un documento válido.");
          await sock.sendMessage(sender, {
            text: "❌ No se encontró un documento adjunto.",
          });
          return;
        }

        if (mimetype.endsWith("pdf")) {
          const fileUrl = docMessage.url;
          const fileName = docMessage.fileName || "archivo.pdf";

          console.log(`📄 Documento recibido: ${fileName}, URL: ${fileUrl}`);

          const pdfUrl = await saveImageToStorage(
            {
              message: {
                documentMessage: docMessage,
              },
            },
            sender
          );
          if (!pdfUrl) {
            console.error("❌ No se pudo obtener el documento.");
            await sock.sendMessage(sender, {
              text: "❌ No se pudo procesar tu documento.",
            });
            return;
          }

          const transcripcion = await transcribeImage(pdfUrl, phoneNumber);

          const ComprobanteFlow = users.get(phoneNumber).perfil.ComprobanteFlow;

          ComprobanteFlow.start(
            sender,
            { ...transcripcion.data, imagen: pdfUrl },
            sock
          );
        } else if (
          mimetype.endsWith("spreadsheetml.sheet") ||
          mimetype.endsWith("excel")
        ) {
          await FlowMapper.handleMessage(sender, docMessage, "excel");
        }
      } catch (error) {
        console.error("❌ Error al procesar el documento:", error);
        await sock.sendMessage(sender, {
          text: "❌ Hubo un error al procesar tu documento.",
        });
      }
      break;
    }
    default: {
      await sock.sendMessage(sender, {
        text: `No entiendo este tipo de mensaje (${messageType}). Por favor, envíame texto o un comando válido.`,
      });
    }
  }
};

module.exports = messageResponder;

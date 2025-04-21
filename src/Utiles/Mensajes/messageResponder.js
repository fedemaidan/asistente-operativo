const FlowMapper = require("../../FlowControl/FlowMapper");
const downloadMedia = require("../Chatgpt/downloadMedia");
const ComprobanteFlow = require("../../Flows/Comprobante/ComprobanteFlow");
const analizarExcel = require("../Funciones/analizarExcel");
const transcribeImage = require("../Chatgpt/transcribeImage");
const { saveImageToStorage } = require("../Chatgpt/storageHandler");
const { saveExcelToBuffer } = require("../Chatgpt/storageHandler");

const messageResponder = async (messageType, msg, sock, sender) => {
  switch (messageType) {
    case "text":
    case "text_extended": {
      const text =
        msg.message.conversation || msg.message.extendedTextMessage?.text;
      await FlowMapper.handleMessage(sender, text, sock, messageType);
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

        const transcripcion = await transcribeImage(imageUrl);

        if (!transcripcion) {
          await sock.sendMessage(sender, {
            text: "⚠️ No pude extraer texto de la imagen.",
          });
          return;
        }

        console.log("Esta es la transcripcion", transcripcion);
        ComprobanteFlow.start(
          sender,
          { ...transcripcion.data, imagen: imageUrl },
          sock
        );

        // Enviar el texto extraído al flujo de procesamiento
      } catch (error) {
        console.error("Error al procesar la imagen:", error);
        await sock.sendMessage(sender, {
          text: "❌ Hubo un error al procesar tu imagen.",
        });
      }
      break;
    }
    case "video": {
      const filePath = await downloadMedia(msg.message, "video");
      if (filePath) {
        await sock.sendMessage(sender, {
          text: `He recibido tu video y lo he guardado en: ${filePath}`,
        });
      } else {
        await sock.sendMessage(sender, {
          text: "No pude guardar el video. Intenta nuevamente.",
        });
      }
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
        await FlowMapper.handleMessage(
          sender,
          transcripcion,
          sock,
          messageType
        );
      } catch (error) {
        console.error("Error al procesar el audio:", error);
        await sock.sendMessage(sender, {
          text: "❌ Hubo un error al procesar tu audio.",
        });
      }
      break;
    }
    case "document": {
      try {
        await sock.sendMessage(sender, {
          text: "⏳ Analizando documento... ⏳",
        });
        console.log("messageType", messageType);
        console.log("msg", msg);

        const mimetype = msg.message.documentMessage.mimetype;
        console.log("mimetype", mimetype);

        // Verificar si el mensaje contiene un documento
        let docMessage =
          msg.message.documentMessage ||
          msg.message.documentWithCaptionMessage?.message?.documentMessage;

        if (!docMessage) {
          console.error("❌ El mensaje no contiene un documento válido.");
          await sock.sendMessage(sender, {
            text: "❌ No se encontró un documento adjunto.",
          });
          return;
        }

        if (mimetype.endsWith("pdf")) {
          // Extraer la URL y el nombre del archivo
          const fileUrl = docMessage.url;
          const fileName = docMessage.fileName || "archivo.pdf";

          console.log(`📄 Documento recibido: ${fileName}, URL: ${fileUrl}`);

          // Guardar el documento y obtener su ruta
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

          const transcripcion = await transcribeImage(pdfUrl);

          ComprobanteFlow.start(
            sender,
            { ...transcripcion.data, imagen: pdfUrl },
            sock
          );
        } else if (mimetype.endsWith(".excel")) {
          console.log("Es un Excel");
        }
      } catch (error) {
        console.error("❌ Error al procesar el documento:", error);
        await sock.sendMessage(sender, {
          text: "❌ Hubo un error al procesar tu documento.",
        });
      }
      break;
    }
    case "document-caption": {
      try {
        await sock.sendMessage(sender, {
          text: "⏳ Analizando Excel... ⏳",
        });

        const { data, success } = await saveExcelToBuffer(msg, sender);

        if (!success) {
          await sock.sendMessage(sender, {
            text: "❌ No se encontró un documento Excel válido.",
          });
          return;
        }

        analizarExcel(data, sender, sock);
      } catch (error) {
        console.error("❌ Error al procesar el Excel:", error);
        await sock.sendMessage(sender, {
          text: "❌ Hubo un error al procesar tu archivo Excel.",
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

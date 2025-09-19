const downloadMedia = require("../Chatgpt/downloadMedia");
const transcribeImage = require("../Chatgpt/transcribeImage");
const { saveImageToStorage } = require("../Chatgpt/storageHandler");
const botSingleton = require("../botSingleton");
const { parseCsvToJson } = require("../Funciones/Csv/csvHandler");
const { parseExcelToJson } = require("../Funciones/Excel/excelHandler");
const { subirExcelADrive } = require("../Funciones/Excel/excelToDrive");

const messageResponder = async (messageType, msg, sender) => {
  const phoneNumber = sender.split("@")[0];
  const sock = botSingleton.getSock();
  const users = botSingleton.getUsers();

  console.log("messageType", messageType);
  console.log("msgContent", msg);

  if (!users.has(phoneNumber)) {
    console.log(`Usuario ${phoneNumber} no encontrado en el mapa de usuarios.`);
    return;
  }

  const FlowMapper = users.get(phoneNumber).perfil.FlowMapper;
  switch (messageType) {
    case "text":
    case "text_extended": {
      if ("drive" === users.get(phoneNumber).perfil.name) {
        return;
      }

      const text =
        msg.message.conversation || msg.message.extendedTextMessage?.text;
      await FlowMapper.handleMessage(sender, text, messageType);

      break;
    }
    case "image": {
      try {
        if (msg?.message?.albumMessage) {
          return;
        }
        // Verificar si el mensaje tiene una imagen (no audio)
        if (!msg.message || !msg.message.imageMessage) {
          await sock.sendMessage(sender, {
            text: "❌ No se encontró una imagen en el mensaje.",
          });
          return;
        }

        const imageUrl = await saveImageToStorage(msg, sender);
        const incomingCaption = msg?.message?.imageMessage?.caption;
        if (incomingCaption) {
          botSingleton.updateAlbumCaption(sender, incomingCaption);
        }
        const albumCaption = botSingleton.getAlbumCaption(sender);

        if (users.get(phoneNumber).perfil.name === "celulandia") {
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
        } else if (users.get(phoneNumber).perfil.name === "financiera") {
          const FlowMapper = users.get(phoneNumber).perfil.FlowMapper;
          await FlowMapper.handleMessage(sender, msg, messageType);
        } else if ("drive" === users.get(phoneNumber).perfil.name) {
          const FlowMapper = users.get(phoneNumber).perfil.FlowMapper;

          await FlowMapper.handleMessage(
            sender,
            {
              imageUrl,
              caption:
                albumCaption ??
                incomingCaption ??
                msg?.message?.imageMessage?.caption,
              mimeType: msg?.message?.imageMessage?.mimeType,
            },
            messageType
          );
          // Marcar imagen del álbum como procesada
          botSingleton.markAlbumImageProcessed(sender);
        }
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
        if ("drive" === users.get(phoneNumber).perfil.name) {
          return;
        }
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

        if (!docMessage) {
          console.error("❌ El mensaje no contiene un documento válido.");
          await sock.sendMessage(sender, {
            text: "❌ No se encontró un documento adjunto.",
          });
          return;
        }

        if (mimetype.endsWith("pdf")) {
          const pdfUrl = await saveImageToStorage(
            { message: { documentMessage: docMessage } },
            sender
          );
          if (!pdfUrl) {
            await sock.sendMessage(sender, {
              text: "❌ No se pudo procesar tu documento.",
            });
            return;
          }

          if ("drive" === users.get(phoneNumber).perfil.name) {
            const FlowMapper = users.get(phoneNumber).perfil.FlowMapper;
            await FlowMapper.handleMessage(
              sender,
              {
                imageUrl: pdfUrl,
                caption:
                  docMessage?.caption ||
                  docMessage?.fileName?.replace(/\.pdf$/i, ""),
                mimeType: "application/pdf",
              },
              "image" // reutilizamos el mismo pipeline que imagen
            );
            return;
          }

          // Otros perfiles mantienen comportamiento previo
          if (users.get(phoneNumber).perfil.name === "celulandia") {
            const transcripcion = await transcribeImage(pdfUrl, phoneNumber);
            const ComprobanteFlow =
              users.get(phoneNumber).perfil.ComprobanteFlow;
            ComprobanteFlow.start(
              sender,
              { ...transcripcion.data, imagen: pdfUrl },
              sock
            );
            return;
          }
          if (users.get(phoneNumber).perfil.name === "financiera") {
            const FlowMapper = users.get(phoneNumber).perfil.FlowMapper;
            await FlowMapper.handleMessage(sender, msg, messageType);
            return;
          }
        } else if (
          mimetype.endsWith("spreadsheetml.sheet") ||
          mimetype.endsWith("excel")
        ) {
          if ("drive" === users.get(phoneNumber).perfil.name) {
            return;
          }

          const { data, fileName, success, error } = await parseExcelToJson(
            docMessage
          );

          if (!success) {
            await sock.sendMessage(sender, {
              text: "❌ No se pudo procesar el archivo Excel.",
            });
            console.error("❌ No se pudo procesar el archivo Excel.", error);
            return;
          }

          const carpetaId = process.env.GOOGLE_DRIVE_FOLDER_ID;
          const driveResult = await subirExcelADrive(docMessage, carpetaId);

          let driveInfo = {};
          if (driveResult.success) {
            driveInfo = {
              driveFileId: driveResult.driveFileId,
              driveUrl: driveResult.driveUrl,
              driveFileName: driveResult.fileName,
            };
            console.log("Excel subido a Drive:", driveInfo);
          } else {
            console.warn("No se pudo subir Excel a Drive:", driveResult.error);
            throw new Error(driveResult.error);
          }

          await FlowMapper.handleMessage(
            sender,
            { data, fileName, type: "Excel", ...driveInfo },
            "excel"
          );
        } else if (mimetype.endsWith("csv")) {
          if ("drive" === users.get(phoneNumber).perfil.name) {
            return;
          }
          const result = await parseCsvToJson(docMessage);
          console.log("ParseCsvToJson", result);
          if (!result.success) {
            await sock.sendMessage(sender, {
              text: "❌ No se pudo procesar el archivo CSV.",
            });
            return;
          }

          await FlowMapper.handleMessage(
            sender,
            { data: result.data, fileName: "csv", type: "CSV" },
            "csv"
          );
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
      // Algunos clientes envían un mensaje "albumMessage" (tipo unknown) previo a las imágenes.
      // Lo ignoramos para evitar mensajes innecesarios.
      if (
        (messageType === "unknown" && msg?.message?.albumMessage) ||
        "drive" === users.get(phoneNumber).perfil.name
      ) {
        return;
      }
      await sock.sendMessage(sender, {
        text: `No entiendo este tipo de mensaje (${messageType}). Por favor, envíame texto o un comando válido.`,
      });
    }
  }
};

module.exports = messageResponder;

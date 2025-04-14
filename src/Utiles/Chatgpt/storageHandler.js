const fs = require("fs");
const path = require("path");
const os = require("os");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const { admin } = require("../Chatgpt/firebaseUtils"); // Configuración de Firebase Admin
const { convertPdfToJpeg } = require("../Chatgpt/convertPdfToJpeg");
const XLSX = require("xlsx");

async function saveFileToStorage(buffer, fileName, filePath, mimeType) {
  const bucket = admin.storage().bucket();

  try {
    const file = bucket.file(filePath);
    await file.save(buffer, { metadata: { contentType: mimeType } });

    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: "03-09-2491",
    });

    console.log(`Archivo subido: ${signedUrl}`);
    return { success: true, signedUrl };
  } catch (error) {
    console.error("Error al guardar archivo en Firebase:", error.message);
    return { success: false, error: error.message };
  }
}

async function saveImageToStorage(message, senderPhone) {
  try {
    const element =
      message.message.imageMessage ||
      message.message.videoMessage ||
      message.message.audioMessage ||
      message.message.documentMessage;
    const mimeType = element.mimetype;
    const buffer = await downloadMediaMessage(message, "buffer");
    const date = new Date().toISOString().split("T")[0];
    const randomNumber = Math.floor(Math.random() * 1000000);

    if (mimeType === "application/pdf") {
      // Guardar PDF temporalmente
      const tempDir = os.tmpdir();
      const pdfPath = path.join(tempDir, `${randomNumber}.pdf`);
      fs.writeFileSync(pdfPath, buffer);

      // Convertir PDF a imágenes
      const outputDir = path.join(tempDir, `pdf_images_${randomNumber}`);
      fs.mkdirSync(outputDir, { recursive: true });

      const { outputPrefix, pageCount } = await convertPdfToJpeg(
        pdfPath,
        outputDir
      );

      if (pageCount === 0) {
        console.error("No se generaron imágenes del PDF.");
        return null;
      }

      // Subir la primera imagen generada
      const firstPagePath = `${outputPrefix}-1.jpeg`;
      const imageBuffer = fs.readFileSync(firstPagePath);

      const filePath = `comprobantes-prueba/${senderPhone}/${date}/${randomNumber}.jpeg`;
      const storageResult = await saveFileToStorage(
        imageBuffer,
        `${randomNumber}.jpeg`,
        filePath,
        "image/jpeg"
      );

      return storageResult.success ? storageResult.signedUrl : null;
    } else {
      // Guardar imagen normal
      const filePath = `comprobantes-prueba/${senderPhone}/${date}/${randomNumber}.jpeg`;
      const storageResult = await saveFileToStorage(
        buffer,
        `${randomNumber}.jpeg`,
        filePath,
        "image/jpeg"
      );
      return storageResult.success ? storageResult.signedUrl : null;
    }
  } catch (error) {
    console.error("Error descargando/guardando archivo:", error.message);
    return null;
  }
}

async function saveExcelToBuffer(message) {
  try {
    const docMessage =
      message.message.documentWithCaptionMessage?.message?.documentMessage ||
      message.message.documentMessage;

    if (!docMessage) {
      console.error("No se encontró el documento en el mensaje");
      return { success: false, error: "No document message found" };
    }

    const mimeType = docMessage.mimetype;

    if (!mimeType.endsWith("spreadsheetml.sheet")) {
      console.error("El archivo no es un Excel válido");
      return { success: false, error: "Not a valid Excel file" };
    }

    const buffer = await downloadMediaMessage(
      { message: { documentMessage: docMessage } },
      "buffer"
    );

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    return {
      success: true,
      data: jsonData,
      fileName: docMessage.fileName || "excel.xlsx",
    };
  } catch (error) {
    console.error("Error procesando archivo Excel:", error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  saveImageToStorage,
  saveFileToStorage,
  saveExcelToBuffer,
};

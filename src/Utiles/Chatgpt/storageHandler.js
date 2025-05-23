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

module.exports = {
  saveImageToStorage,
  saveFileToStorage,
};

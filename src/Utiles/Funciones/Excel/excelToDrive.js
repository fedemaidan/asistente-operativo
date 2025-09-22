const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const os = require("os");

async function subirExcelADrive(docMessage, carpetaId) {
  let tempFilePath = null;

  try {
    // Descargar el archivo Excel como buffer
    const buffer = await downloadMediaMessage(
      { message: { documentMessage: docMessage } },
      "buffer"
    );

    // Crear archivo temporal
    const tempDir = os.tmpdir();
    const fileName = docMessage.title || `excel_${Date.now()}.xlsx`;
    tempFilePath = path.join(tempDir, fileName);

    // Escribir el buffer al archivo temporal
    fs.writeFileSync(tempFilePath, buffer);

    // Determinar el mimeType correcto
    const mimeType =
      docMessage.mimetype ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    // Subir directamente a la carpeta especificada
    const { google } = require("googleapis");
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
      ],
    });
    const drive = google.drive({ version: "v3", auth });

    const driveResult = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType,
        parents: [carpetaId],
      },
      media: {
        mimeType,
        body: fs.createReadStream(tempFilePath),
      },
      supportsAllDrives: true,
    });

    // Construir URL de visualización
    const driveUrl = `https://drive.google.com/file/d/${driveResult.data.id}/view`;

    return {
      success: true,
      driveFileId: driveResult.data.id,
      driveUrl,
      fileName: driveResult.data.name,
    };
  } catch (error) {
    console.error("Error al subir Excel a Drive:", error);
    return {
      success: false,
      error: error.message,
    };
  } finally {
    // Limpiar archivo temporal
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn(
          "Error al limpiar archivo temporal:",
          cleanupError.message
        );
      }
    }
  }
}

async function subirExcelBufferADrive(
  buffer,
  fileName,
  carpetaId,
  mimeTypeOverride
) {
  let tempFilePath = null;
  try {
    const tempDir = os.tmpdir();
    const safeName = fileName || `excel_${Date.now()}.xlsx`;
    tempFilePath = path.join(tempDir, safeName);
    fs.writeFileSync(tempFilePath, buffer);

    const mimeType =
      mimeTypeOverride ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    const { google } = require("googleapis");
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
      ],
    });
    const drive = google.drive({ version: "v3", auth });

    const driveResult = await drive.files.create({
      requestBody: {
        name: safeName,
        mimeType,
        parents: [carpetaId],
      },
      media: {
        mimeType,
        body: fs.createReadStream(tempFilePath),
      },
      supportsAllDrives: true,
    });

    const driveUrl = `https://drive.google.com/file/d/${driveResult.data.id}/view`;
    return {
      success: true,
      driveFileId: driveResult.data.id,
      driveUrl,
      fileName: driveResult.data.name,
    };
  } catch (error) {
    console.error("Error al subir Buffer de Excel a Drive:", error);
    return { success: false, error: error.message };
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn(
          "Error al limpiar archivo temporal:",
          cleanupError.message
        );
      }
    }
  }
}

module.exports = {
  subirExcelADrive,
  subirExcelBufferADrive,
};

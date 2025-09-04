const { google } = require("googleapis");
const fs = require("fs");

// ────────────────────────────────────────────────────────────────────────────────
//  🔐  Autenticación
// ────────────────────────────────────────────────────────────────────────────────
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
  ],
});
const drive = google.drive({ version: "v3", auth });
const supports = { supportsAllDrives: true };

// ────────────────────────────────────────────────────────────────────────────────
//  📁  Carpetas
// ────────────────────────────────────────────────────────────────────────────────
async function encontrarOCrearCarpetaPorNombre(
  carpetaPadreId,
  nombre,
  visible = false
) {
  let carpetaExistenteId = null;

  try {
    const res = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${nombre}' and '${carpetaPadreId}' in parents and trashed=false`,
      fields: "files(id,name)",
      spaces: "drive",
      ...supports,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "allDrives",
    });

    if (res?.data?.files?.length > 0) {
      carpetaExistenteId = res.data.files[0].id;
    }
  } catch (e) {
    console.warn(
      `⚠️ Error al buscar carpeta '${nombre}' en '${carpetaPadreId}':`,
      e.message
    );
  }

  if (carpetaExistenteId) return carpetaExistenteId;

  // Crear carpeta nueva
  const folder = await drive.files.create({
    requestBody: {
      name: nombre,
      mimeType: "application/vnd.google-apps.folder",
      parents: [carpetaPadreId],
    },
    fields: "id",
    supportsAllDrives: true, // Soporte para unidades compartidas
  });

  const folderId = folder.data.id;

  // Dar acceso de lectura a cualquiera con el link
  try {
    await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      ...supports,
    });
    console.log(
      `🔓 Carpeta '${nombre}' ahora es visible para cualquiera con el link.`
    );
  } catch (error) {
    console.warn(
      `⚠️ No se pudo hacer pública la carpeta '${nombre}':`,
      error.message
    );
  }

  return folderId;
}

// ────────────────────────────────────────────────────────────────────────────────
//  ⬆️  Subir archivo
// ────────────────────────────────────────────────────────────────────────────────
async function subirArchivoADrive(
  nombreArchivo,
  mimeType,
  carpetaId,
  file_url,
  categoria
) {
  try {
    const carpetaCategoriaId = await encontrarOCrearCarpetaPorNombre(
      carpetaId,
      categoria
    );

    const res = await drive.files.list({
      q: `'${carpetaCategoriaId}' in parents and trashed=false`,
      fields: "files(id)",
      spaces: "drive",
      ...supports,
    });

    const cantidadName = res?.data?.files?.length
      ? res.data.files.length + 1
      : 1;

    const respuesta = await drive.files.create({
      requestBody: {
        name: `${nombreArchivo}${cantidadName}`,
        mimeType,
        parents: [carpetaCategoriaId],
      },
      media: {
        mimeType,
        body: fs.createReadStream(file_url),
      },
      ...supports,
    });

    console.log("Archivo subido con éxito:", respuesta.data);
    return respuesta.data;
  } catch (error) {
    console.error("Error al subir el archivo a Google Drive:", error);
    throw error;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
//  🔄  Reemplazar archivo
// ────────────────────────────────────────────────────────────────────────────────
async function reemplazarArchivoDrive(fileId, nuevoArchivoPath, nuevoMimeType) {
  try {
    const response = await drive.files.update({
      fileId,
      media: {
        mimeType: nuevoMimeType,
        body: fs.createReadStream(nuevoArchivoPath),
      },
      requestBody: {},
      ...supports,
    });

    console.log("Archivo reemplazado con éxito:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error al reemplazar el archivo en Google Drive:", error);
    throw error;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
//  🔄  Mover archivos
// ────────────────────────────────────────────────────────────────────────────────
async function moverArchivoDrive(archivoId, carpetaDestinoId, carpetaOrigenId) {
  try {
    await drive.files.update({
      fileId: archivoId,
      addParents: carpetaDestinoId,
      removeParents: carpetaOrigenId,
      supportsAllDrives: true,
    });
    console.log(
      `📦 Archivo ${archivoId} movido de ${carpetaOrigenId} a ${carpetaDestinoId}`
    );
  } catch (error) {
    console.warn(`⚠️ Error al mover archivo ${archivoId}:`, error.message);
    throw error;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
//  🤝  Compartir carpeta con un email
// ────────────────────────────────────────────────────────────────────────────────
async function compartirCarpetaConEmail(folderId, email) {
  try {
    await drive.permissions.create({
      fileId: folderId,
      requestBody: { role: "writer", type: "user", emailAddress: email },
      ...supports,
    });
    console.log(`Carpeta ${folderId} compartida con ${email}`);
  } catch (error) {
    console.error("Error al compartir la carpeta en Google Drive:", error);
    throw error;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
//  🗑️  Eliminar archivo
// ────────────────────────────────────────────────────────────────────────────────
async function eliminarArchivoDrive(fileId) {
  try {
    await drive.files.delete({ fileId, ...supports });
    console.log(`Archivo ${fileId} eliminado de Drive`);
    return true;
  } catch (error) {
    console.error(`Error al eliminar el archivo ${fileId}:`, error);
    throw error;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
//  📦  Exportaciones
// ────────────────────────────────────────────────────────────────────────────────
module.exports = {
  subirArchivoADrive,
  reemplazarArchivoDrive,
  encontrarOCrearCarpetaPorNombre,
  compartirCarpetaConEmail,
  drive,
  eliminarArchivoDrive,
  moverArchivoDrive,
};

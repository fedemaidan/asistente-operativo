const {
  encontrarOCrearCarpetaPorNombre,
  drive,
} = require("../../google-drive");
const path = require("path");
const https = require("https");
const http = require("http");

// Devuelve un ReadableStream de la respuesta HTTP/HTTPS para usarlo como body
function streamFromUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const request = client.get(url, (response) => {
      // Manejo de redirect 3xx
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers?.location
      ) {
        // Seguir la redirección
        streamFromUrl(response.headers.location).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Descarga fallida (${response.statusCode})`));
        return;
      }
      resolve(response); // IncomingMessage es Readable
    });

    request.on("error", reject);
  });
}

async function guardarArchivoDrive(
  imageUrl,
  carpetaPadreId,
  nombreArchivo,
  baseName = "imagen"
) {
  console.log("imageUrl", imageUrl);
  try {
    const fechaActual = new Date();
    const año = fechaActual.getFullYear();
    const meses = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    const mes = meses[fechaActual.getMonth()];
    const nombreCarpeta = `${año}-${mes}`;

    console.log(`📁 Creando/buscando carpeta: ${nombreCarpeta}`);

    // Crear o encontrar la carpeta del mes actual
    const carpetaMesId = await encontrarOCrearCarpetaPorNombre(
      carpetaPadreId,
      nombreCarpeta,
      true // visible = true para que sea accesible
    );

    console.log(`✅ Carpeta encontrada/creada: ${carpetaMesId}`);

    // Determinar el tipo MIME basado en la extensión de la URL (sin query params)
    const cleanUrl = String(imageUrl).split("?")[0];
    const extension = path.extname(cleanUrl).toLowerCase();
    let mimeType = "image/jpeg";

    switch (extension) {
      case ".jpg":
      case ".jpeg":
        mimeType = "image/jpeg";
        break;
      case ".png":
        mimeType = "image/png";
        break;
      case ".gif":
        mimeType = "image/gif";
        break;
      case ".webp":
        mimeType = "image/webp";
        break;
      case ".bmp":
        mimeType = "image/bmp";
        break;
      default:
        console.warn(
          `⚠️ Extensión no reconocida: ${extension}, usando image/jpeg por defecto`
        );
    }

    // Contar archivos existentes para numeración
    const res = await drive.files.list({
      q: `'${carpetaMesId}' in parents and trashed=false`,
      fields: "files(id)",
      spaces: "drive",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "allDrives",
    });

    let nombreFinal;

    if (nombreArchivo && nombreArchivo.trim() !== "") {
      nombreFinal = nombreArchivo.trim();
    } else {
      const cantidadArchivos = res?.data?.files?.length
        ? res.data.files.length + 1
        : 1;
      nombreFinal = `${baseName}${cantidadArchivos}`;
    }

    console.log(`📤 Subiendo imagen desde URL: ${imageUrl}`);

    // Crear stream desde la URL
    const imageStream = await streamFromUrl(imageUrl);

    // Crear archivo en Drive usando el stream
    const respuesta = await drive.files.create({
      requestBody: {
        name: nombreFinal,
        mimeType,
        parents: [carpetaMesId],
      },
      media: {
        mimeType,
        body: imageStream,
      },
      supportsAllDrives: true,
    });

    console.log(`✅ Archivo guardado exitosamente en Drive:`, respuesta.data);
    return { data: respuesta.data, success: true };
  } catch (error) {
    console.error("❌ Error al guardar archivo en Drive:", error);
    return { data: null, success: false };
  }
}

module.exports = {
  guardarArchivoDrive,
};

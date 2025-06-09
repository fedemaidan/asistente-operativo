const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);
const fs = require("fs");

const path = require("path");

async function convertPdfToJpeg(pdfPath, outputDir, newFileName = "page") {
    try {
        const outputPrefix = path.join(outputDir, newFileName);
        const command = `pdftoppm -jpeg ${pdfPath} ${outputPrefix}`;
        
        console.log("Iniciando conversión de PDF a imágenes...");

        // Ejecuta el comando y espera a que termine
        const { stdout, stderr } = await execPromise(command);

        if (stderr) {
            console.error("Error durante la conversión:", stderr);
        } else {
            console.log("Conversión completada con éxito:", stdout);
        }

        const files = fs.readdirSync(outputDir);
        files.forEach(file => {
            if (file.endsWith(".jpg")) {
                const oldPath = path.join(outputDir, file);
                const newPath = oldPath.replace(".jpg", ".jpeg");
                fs.renameSync(oldPath, newPath);
            }
        });

        // Contar el número de hojas convertidas
        const jpegFiles = fs.readdirSync(outputDir).filter(file =>
            file.startsWith(newFileName) && file.endsWith(".jpeg")
        );

        const pageCount = jpegFiles.length;

        console.log(`Número total de hojas convertidas: ${pageCount}`);

        return { outputPrefix, pageCount }
    } catch (error) {
        console.error("Error al ejecutar el comando:", error);
    }
}

module.exports = { convertPdfToJpeg };

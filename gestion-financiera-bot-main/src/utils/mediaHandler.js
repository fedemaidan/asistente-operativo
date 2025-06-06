const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const downloadMedia = async (message, messageType) => {
    try {
        // Verificar si el mensaje contiene contenido multimedia
        const mediaContent = message?.[`${messageType}Message`];
        if (!mediaContent) {
            throw new Error('No se encontró contenido multimedia en el mensaje.');
        }

        // Construir la estructura mínima del mensaje
        const enrichedMessage = {
            key: message.key || {
                remoteJid: 'unknown',
                id: 'unknown',
                fromMe: false,
            },
            message: {
                [`${messageType}Message`]: mediaContent,
            },
        };

        console.log('Mensaje enriquecido:', enrichedMessage);

        // Descargar el contenido multimedia (ya es un Buffer)
        const buffer = await downloadMediaMessage(enrichedMessage, 'buffer');
        console.log('Buffer obtenido:', buffer);

        // Guardar el archivo en el sistema
        const fileName = `${messageType}_${Date.now()}.jpeg`;
        const filePath = path.join(__dirname, '../downloads', fileName);

        // Crear el directorio si no existe
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, buffer);

        console.log(`Archivo guardado en: ${filePath}`);
        return filePath;
    } catch (error) {
        console.error('Error descargando contenido multimedia:', error.message);
        return null;
    }
};

module.exports = { downloadMedia };

/**
 * Función para identificar el tipo de mensaje recibido
 * @param {object} message - Objeto del mensaje
 * @returns {string} - Tipo de mensaje
 */
const GetType = (message) => {
    if (message.conversation) return 'text';
    if (message.extendedTextMessage) return 'text_extended';
    if (message.imageMessage) return 'image';
    if (message.videoMessage) return 'video';
    if (message.audioMessage) return 'audio';
    if (message.documentMessage) return 'document';
    if (message.documentWithCaptionMessage) return 'document-caption';
    if (message.stickerMessage) return 'sticker';
    if (message.contactMessage) return 'contact';
    if (message.locationMessage) return 'location';
    if (message.liveLocationMessage) return 'live_location';
    // Si no coincide con ningún tipo conocido, se retorna 'unknown'
    return 'unknown';
};

// Exporta la función para poder identificar el tipo en index.js
module.exports = GetType;

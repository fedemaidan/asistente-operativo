const getMessageType = (message) => {
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
    return 'unknown'; // Si no es ninguno de los anteriores
};

module.exports = getMessageType;

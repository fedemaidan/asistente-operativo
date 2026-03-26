//const baileysAutoReporter = require("baileys-status-reporter");
const UsuarioBotService = require("../services/usuarioBotService");

class BotSingleton {
  constructor() {
    if (!BotSingleton.instance) {
      this.sock = {}; // Se guardará la instancia única de sock
      this.users = new Map(); // Mapa para almacenar usuarios y sus perfiles
      this.usuarioBotService = new UsuarioBotService();
      // Estado de álbum por usuario: { expected, processed, caption, startTs }
      this.albumStateByUser = new Map();
      BotSingleton.instance = this;
    }

    return BotSingleton.instance;
  }
  async setSock(sockInstance) {
    this.sock = sockInstance;

    //baileysAutoReporter.startAutoReport(
    //  this.sock,
    //  "asistente-operativo",
    //  "http://localhost:4000/api/reportar"
    //);

    // Escucha mensajes entrantes
    this.sock.ev.on("messages.upsert", async (message) => {
      const getMessageType = require("./Mensajes/GetType");
      const messageResponder = require("./Mensajes/messageResponder");
      const msg = message.messages[0];

      if (msg.key.fromMe) {
        if (
          msg.message?.conversation === "TODO_OK" ||
          msg.message?.extendedTextMessage?.text === "TODO_OK"
        ) {
          //console.log("🟢 Mensaje TODO_OK recibido, marcando ping como OK.");
          //autoReporter.marcarPingOK();
        }
      }

      if (!msg.message || msg.key.fromMe) return;

      const sender = msg.key.remoteJid;

      // Identificar el tipo de mensaje
      const messageType = getMessageType(msg.message);

      // Si llega un álbum, inicializamos estado de álbum para el usuario
      if (msg?.message?.albumMessage?.expectedImageCount) {
        const expected = msg.message.albumMessage.expectedImageCount;
        this.startAlbum(sender, expected);
      }

      // Delegar manejo al messageResponder
      await messageResponder(messageType, msg, sender);
    });

    setInterval(
      async () => await this.sock.sendPresenceUpdate("available"),
      10 * 60 * 1000
    );
  }

  // Obtiene la instancia del sock
  getSock() {
    return this.sock;
  }

  setUsers(usersMap) {
    this.users = usersMap;
  }

  getUsers() {
    return this.users;
  }

  // ==== Estado de álbum por usuario ====
  startAlbum(userId, expected) {
    this.albumStateByUser.set(userId, {
      expected: Number(expected) || 0,
      processed: 0,
      caption: null,
      startTs: Date.now(),
    });
  }

  updateAlbumCaption(userId, caption) {
    if (!caption) return;
    const st = this.albumStateByUser.get(userId);
    if (st) {
      if (!st.caption) st.caption = caption;
      this.albumStateByUser.set(userId, st);
    }
  }

  getAlbumCaption(userId) {
    const st = this.albumStateByUser.get(userId);
    return st?.caption || null;
  }

  markAlbumImageProcessed(userId) {
    const st = this.albumStateByUser.get(userId);
    if (!st) return;
    st.processed += 1;
    if (st.processed >= st.expected) {
      this.albumStateByUser.delete(userId);
    } else {
      this.albumStateByUser.set(userId, st);
    }
  }

  phoneFromUserId(userId) {
    return String(userId || "").split("@")[0];
  }

  async getSheetIdByUserId(userId) {
    const phoneNumber = this.phoneFromUserId(userId);
    const row = await this.usuarioBotService.get(phoneNumber);
    const GOOGLE_SHEET_ID = row?.perfil?.googleSheetId;

    if (!GOOGLE_SHEET_ID) {
      throw new Error(
        `No se encontró el Google Sheet ID para el usuario: ${userId}`
      );
    }

    return GOOGLE_SHEET_ID;
  }

  async getUsuarioByUserId(userId) {
    const phoneNumber = this.phoneFromUserId(userId);
    const row = await this.usuarioBotService.get(phoneNumber);
    if (!row) {
      throw new Error(`No se encontró el usuario: ${userId}`);
    }
    return row.nombre;
  }

  async getDriveFolderIdByUserId(userId) {
    const phoneNumber = this.phoneFromUserId(userId);
    const row = await this.usuarioBotService.get(phoneNumber);
    return row?.perfil?.driveFolderId;
  }
}

module.exports = new BotSingleton();

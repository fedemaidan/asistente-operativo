class BotSingleton {
  constructor() {
    if (!BotSingleton.instance) {
      this.sock = {}; // Se guardará la instancia única de sock
      this.users = new Map(); // Mapa para almacenar usuarios y sus perfiles
      BotSingleton.instance = this;
    }

    return BotSingleton.instance;
  }
  async setSock(sockInstance) {
    this.sock = sockInstance;
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

  getSheetIdByUserId(userId) {
    const phoneNumber = userId.split("@")[0];
    const GOOGLE_SHEET_ID = this.users.get(phoneNumber).perfil.googleSheetId;

    if (!GOOGLE_SHEET_ID) {
      throw new Error(
        `No se encontró el Google Sheet ID para el usuario: ${userId}`
      );
    }

    return GOOGLE_SHEET_ID;
  }

  getUsuarioByUserId(userId) {
    const phoneNumber = userId.split("@")[0];
    const usuario = this.users.get(phoneNumber).nombre;

    return usuario;
  }
}

module.exports = new BotSingleton();

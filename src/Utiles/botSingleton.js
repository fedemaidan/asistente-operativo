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
}

module.exports = new BotSingleton();

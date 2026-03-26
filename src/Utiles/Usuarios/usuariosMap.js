const UsuarioBotService = require("../../services/usuarioBotService");

async function loadUsersMapFromDatabase() {
  const service = new UsuarioBotService();
  await service.seedLegacyIfEmpty();
  return service.loadUsersMap();
}

module.exports = loadUsersMapFromDatabase;

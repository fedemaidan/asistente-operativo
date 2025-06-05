const { perfilCelulandia, perfilCelulandiaDev } = require("./usuariosPerfiles");

const users = new Map([
  ["5493876147003", perfilCelulandia],
  ["5491162948395", perfilCelulandiaDev],
]);

module.exports = users;

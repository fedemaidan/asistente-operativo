const {
  perfilCelulandiaDev,
  perfilFinancieraDev,
} = require("./usuariosPerfiles");

const users = new Map([
  ["5493876147003", perfilFinancieraDev],
  ["5491162948395", perfilCelulandiaDev],
]);

module.exports = users;

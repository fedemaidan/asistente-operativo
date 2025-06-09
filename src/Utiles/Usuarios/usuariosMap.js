const {
  perfilCelulandiaDev,
  perfilFinancieraDev,
  perfilCelulandia,
} = require("./usuariosPerfiles");

const users = new Map([
  ["5493876147003", { perfil: perfilCelulandiaDev, nombre: "Martin" }],
  ["5491162948395", { perfil: perfilCelulandiaDev, nombre: "Federico" }],
  ["5491154709252", { perfil: perfilCelulandia, nombre: "Ezequiel" }],
  ["5491126032204", { perfil: perfilCelulandia, nombre: "Ventas" }],
  ["5491165000590", { perfil: perfilCelulandia, nombre: "Nicolas" }],
  ["5493424421565", { perfil: perfilCelulandia, nombre: "Matias" }],
]);

module.exports = users;

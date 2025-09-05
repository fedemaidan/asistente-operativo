const {
  perfilCelulandiaDev,
  perfilFinancieraDev,
  perfilCelulandia,
  perfilFinanciera,
  perfilDriveDev,
  perfilDrive,
} = require("./usuariosPerfiles");

const users = new Map([
  ["5493876147003", { perfil: perfilDriveDev, nombre: ["Martin", "Fede"] }],
  ["5493416569286", { perfil: perfilDrive, nombre: ["Diego"] }],
  ["5493413191527", { perfil: perfilDrive, nombre: ["Abel"] }],
  ["5493416820179", { perfil: perfilDrive, nombre: ["Gabriel"] }],
  ["5491162948395", { perfil: perfilCelulandiaDev, nombre: ["Federico"] }],
  ["5491136322541", { perfil: perfilDriveDev, nombre: ["Facu"] }],
  ["5491154709252", { perfil: perfilCelulandia, nombre: ["Ezequiel"] }],
  ["5491126032204", { perfil: perfilCelulandia, nombre: ["Matias", "Naomi"] }],
  ["5491165000590", { perfil: perfilCelulandia, nombre: ["Nicolas"] }],
  ["5493424421565", { perfil: perfilCelulandia, nombre: ["Matias"] }],
  ["5491131906768", { perfil: perfilFinanciera, nombre: "-" }],
  ["5491133929019", { perfil: perfilFinanciera, nombre: "-" }],
]);

module.exports = users;

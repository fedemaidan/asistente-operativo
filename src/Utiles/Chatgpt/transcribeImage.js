const botSingleton = require("../botSingleton");
const { getByChatgpt4Vision } = require("../Chatgpt/Base");

async function transcribeImage(imagePath, phoneNumber) {
  const users = botSingleton.getUsers();
  try {
    prompt = users.get(phoneNumber).perfil.prompts.transcribeImage;

    // Consultar a OpenAI
    const response = await getByChatgpt4Vision([imagePath], prompt);

    const respuesta = JSON.parse(response);

    if (respuesta.hasOwnProperty("json_data")) {
      return respuesta.json_data;
    } else {
      return respuesta;
    }
  } catch (error) {
    console.error("Error analizando la factura en OPEN IA:", error.message);
    return null;
  }
}
module.exports = transcribeImage;

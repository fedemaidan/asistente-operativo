const { OpenAI } = require("openai/index.js");

require("dotenv").config();

console.log("process.env.OPENAI_API_KEY", process.env.OPENAI_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
module.exports = openai;

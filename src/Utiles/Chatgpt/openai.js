const { OpenAI } = require("openai/index.js");

require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
module.exports = openai;

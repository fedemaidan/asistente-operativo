const fs = require("fs");
const openai = require("./openai");

module.exports = async function transcribeAudio(filePath) {
  const prompt = "Sos un experto transcribiendo audios.";

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      prompt: prompt,
    });

    return transcription.text;
  } catch (error) {
    console.error(
      "Error transcribiendo audio:",
      error.response?.data || error.message
    );
    throw error;
  }
};

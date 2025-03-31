const openai = require('../Chatgpt/openai');

function limpiarJson(str) {
    return str.replace(/```json\n?|```\n?/g, '').trim();
}

async function getByChatgpt4Vision(urlsImagenesFacturas, prompt, temperature = 0.2) {
    const content = [
        { type: "text", text: prompt },
    ]

    for (i in urlsImagenesFacturas) {
        const urlImagenFactura = urlsImagenesFacturas[i]
        const obj = {
            type: "image_url",
            image_url: {
                "url": urlImagenFactura,
            },
        }
        content.push(obj)
    }

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        // response_format: { type: "json_object" },
        messages: [
            {
                role: "user",
                content: content
            },
        ],
        temperature: temperature
    });
    return limpiarJson(response.choices[0].message.content);
}

async function getByChatgpt35TurboByText(prompt) {
    const response = await openai.chat.completions.create({
        messages: [{ role: "system", content: prompt }],
        model: "gpt-3.5-turbo",
        temperature: 0.2
    });
    return limpiarJson(response.choices[0].message.content);
}

async function getByChatGpt4o(prompt) {
    try {
      const response =  await openai.chat.completions.create({
        model: "gpt-4o", // 🔥 Mejor rendimiento y costo
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 10000,
        response_format: { type: "json_object" }
      });
      return limpiarJson(response.choices[0].message.content);
    } catch (error) {
      console.error("Error en OpenAI:", error);
      return null;
    }
  }
module.exports = { getByChatgpt35TurboByText, getByChatgpt4Vision, getByChatGpt4o };
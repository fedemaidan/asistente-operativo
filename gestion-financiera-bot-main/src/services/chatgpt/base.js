const openai = require('./openai');

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


      console.log("responseeeee", response.choices[0].message.content)
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

  module.exports = { getByChatgpt35TurboByText, getByChatgpt4Vision };
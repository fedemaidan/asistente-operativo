// Usar fetch nativo de Node.js (disponible desde Node.js 18+)

async function getDolarOficialBancoNacion() {
  const url = "https://www.bna.com.ar/Personas";
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      redirect: "follow",
    });

    if (!resp.ok) {
      throw new Error(`HTTP error! status: ${resp.status}`);
    }

    const html = await resp.text();

    const clean = html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const match = clean.match(/Dolar\s*U\.S\.A\s+([\d.,]+)\s+([\d.,]+)/i);
    if (!match) {
      throw new Error("No se pudo localizar la fila 'Dolar U.S.A'");
    }

    const ventaOficial = parseFloat(
      match[2].replace(/\./g, "").replace(",", ".")
    );

    return Math.floor(ventaOficial);
  } catch (err) {
    console.log("Error al obtener cotización BNA: " + err.message);
    return null;
  }
}

module.exports = getDolarOficialBancoNacion;

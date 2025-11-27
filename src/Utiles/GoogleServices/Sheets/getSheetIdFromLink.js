function getSheetIdFromLink(urlString) {
  if (!urlString || typeof urlString !== 'string') return null;
  try {
    const url = new URL(urlString);
    const { pathname, searchParams } = url;
    // Formato estándar de Google Sheets
    let match = pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) return match[1];
    // Otros formatos de Drive
    match = pathname.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (match) return match[1];
    // Enlace con query ?id=
    const idParam = searchParams.get('id');
    if (idParam) return idParam;
    return null;
  } catch (e) {
    // Fallback si no parsea como URL válida
    const match =
      urlString.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/) ||
      urlString.match(/\/file\/d\/([a-zA-Z0-9-_]+)/) ||
      urlString.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }
}

module.exports = { getSheetIdFromLink };
/**
 * Simulador mínimo de la API de Gemini para las pruebas locales.
 * Las Edge Functions lo usan con GEMINI_API_BASE=http://<host>:<puerto>.
 *
 * - embedContent / batchEmbedContents: vector constante (similitud 1 con todo).
 * - generateContent con herramientas: primero pide buscar en el documento y,
 *   con la evidencia, responde un <div> que la cita.
 * - generateContent sin herramientas: resumen del documento.
 * - GET /__requests: cuerpos recibidos (para comprobar la anonimización).
 */
import http from 'node:http';

const port = Number(process.env.GEMINI_MOCK_PORT || 54399);
const VECTOR = Array.from({ length: 768 }, () => 1 / Math.sqrt(768));
const received = [];

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const textOf = (content) => (content?.parts || []).map((p) => p.text || '').join('');
const isEnglish = (body) => /Responde en inglés|in English/.test(textOf(body.systemInstruction));

function generate(body) {
  const contents = body.contents || [];
  const last = contents[contents.length - 1];
  const english = isEnglish(body);
  if (!body.tools) {
    const doc = textOf(last).replace(/\s+/g, ' ').slice(0, 300);
    const title = english ? 'Technical summary' : 'Resumen técnico';
    return { candidates: [{ content: { role: 'model', parts: [{ text: `<div><h3>${title}</h3><p>${doc}</p></div>` }] } }] };
  }
  const response = last?.parts?.find((p) => p.functionResponse)?.functionResponse?.response;
  if (!response) {
    const query = textOf(last).match(/Consulta: (.*)/)?.[1] || textOf(last);
    const documentId = textOf(last).match(/Documento activo: (\S+)/)?.[1] || '';
    return { candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'search_document_chunks', args: { query, documentId, limit: 4 } } }] } }] };
  }
  const evidence = (response.results || [])
    .map((r) => String(r.content).replace(/<<<(BEGIN|END) RETRIEVED DATA>>>/g, '').trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 400);
  const label = english ? 'According to the document' : 'Según el documento';
  return { candidates: [{ content: { role: 'model', parts: [{ text: `<div data-mock="answer"><strong>${label}:</strong> ${evidence}</div>` }] } }] };
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/__requests') return send(res, 200, received);
  if (req.method === 'DELETE' && req.url === '/__requests') {
    received.length = 0;
    return send(res, 200, { ok: true });
  }
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return send(res, 400, { error: 'bad json' });
    }
    received.push({ url: req.url.replace(/key=[^&]*/, 'key=***'), body });
    if (received.length > 500) received.shift();
    if (req.url.includes(':batchEmbedContents')) {
      return send(res, 200, { embeddings: (body.requests || []).map(() => ({ values: VECTOR })) });
    }
    if (req.url.includes(':embedContent')) return send(res, 200, { embedding: { values: VECTOR } });
    if (req.url.includes(':generateContent')) return send(res, 200, generate(body));
    return send(res, 404, { error: 'not found' });
  });
});

server.listen(port, '0.0.0.0', () => console.log(`Gemini mock listening on ${port}`));

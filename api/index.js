// Minimal adapter to run the existing Express app as a Vercel Serverless Function
import app from '../server/index.js';

export default function handler(req, res) {
  // When using a rewrite with ?path=$1, forward the original path to Express
  try {
    const url = new URL(req.url, 'http://localhost');
    const qp = new URLSearchParams(url.search);
    const seg = qp.get('path');
    if (seg) {
      const origQuery = (() => { qp.delete('path'); const s = qp.toString(); return s ? `?${s}` : ''; })();
      req.url = `/api/${seg}${origQuery}`;
    }
  } catch {}
  return app(req, res);
}

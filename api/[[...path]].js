// Catch-all serverless function to handle all /api/* paths with Express
import app from '../server/index.js';

export default function handler(req, res) {
  // For catch-all, req.url is already the original path (e.g., /api/generate/persona)
  // Pass through to the Express app directly.
  return app(req, res);
}


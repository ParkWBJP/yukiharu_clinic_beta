// Minimal adapter to run the existing Express app as a Vercel Serverless Function
import app from '../server/index.js';

export default function handler(req, res) {
  return app(req, res);
}


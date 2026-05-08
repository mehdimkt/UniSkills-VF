import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

// Servir les fichiers statiques du build
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Servir les fichiers publics
const publicPath = path.join(__dirname, "public");
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "node-server", timestamp: new Date().toISOString() });
});

// SPA fallback
app.get("*", (req, res) => {
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Application not built. Run `npm run build` first.");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Node server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});

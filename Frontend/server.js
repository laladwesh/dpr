import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_PATH = `/${(process.env.BASE_PATH || "listing-ccd").replace(/^\/+|\/+$/g, "")}`;
const PORT = process.env.PORT || 3000;
const distDir = path.join(__dirname, "dist");

const app = express();

app.use(BASE_PATH, express.static(distDir));

app.get("/", (req, res) => res.redirect(`${BASE_PATH}/`));

app.get(`${BASE_PATH}/*splat`, (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Frontend serving "${distDir}" on port ${PORT} at ${BASE_PATH}`);
});

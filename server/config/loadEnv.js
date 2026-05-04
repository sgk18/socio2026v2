import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");

for (const envFile of [".env", ".env.local"]) {
  dotenv.config({
    path: path.join(serverRoot, envFile),
    override: false,
  });
}


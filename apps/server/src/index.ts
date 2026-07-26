import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const databasePath = resolve(process.env.DATABASE_PATH ?? "./data/party-games.sqlite");
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const webDistPath = process.env.WEB_DIST_PATH
  ? resolve(process.env.WEB_DIST_PATH)
  : resolve(currentDirectory, "../../web/dist");

const appOptions = {
  databasePath,
  webDistPath,
  ...(process.env.WEB_ORIGIN ? { webOrigin: process.env.WEB_ORIGIN } : {})
};
const { app } = await createApp(appOptions);

await app.listen({ port, host });

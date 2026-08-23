import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    {
      name: "manor-v7-module-alias",
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url?.startsWith("/module/")) {
            request.url = `/assets/manor/v7-swf/module/${request.url.slice("/module/".length)}`;
          }
          next();
        });
      }
    }
  ],
  worker: {
    format: "es",
    plugins: () => [wasm()]
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3000",
      "/socket.io": {
        target: "http://127.0.0.1:3000",
        ws: true
      }
    }
  }
});

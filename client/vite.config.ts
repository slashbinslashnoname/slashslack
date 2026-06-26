import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// API server port (matches the server's PORT). Override for dev with API_PORT.
const apiPort = process.env.API_PORT || process.env.PORT || "3000";
const clientPort = Number(process.env.CLIENT_PORT) || 5173;
const target = `http://localhost:${apiPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: clientPort,
    strictPort: false,
    proxy: {
      "/api": { target, changeOrigin: true },
      "/uploads": { target, changeOrigin: true },
      "/socket.io": { target, ws: true, changeOrigin: true },
    },
  },
});

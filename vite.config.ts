import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Listen on the local network too, so the iPad can open the dev server.
  server: { host: true },
});

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/jielv-research/",
  plugins: [react()],
  build: {
    outDir: "vercel-dist",
    emptyOutDir: true,
  },
});

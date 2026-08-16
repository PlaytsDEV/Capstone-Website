import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  assetsInclude: ["**/*.JPG"],
  server: {
    port: 3001,
    open: true,
  },
  build: {
    outDir: "build-admin",
    sourcemap: false,
    rollupOptions: {
      input: "admin.html",
      output: {
        manualChunks: {
          "vendor-react": [
            "react",
            "react-dom",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            "react-router-dom",
          ],
          "vendor-tanstack": ["@tanstack/react-query"],
          "vendor-firebase": ["firebase/app", "firebase/auth"],
          "vendor-icons": ["lucide-react", "@tabler/icons-react"],
          "vendor-charts": ["recharts"],
        },
      },
    },
  },
  esbuild: {
    loader: "jsx",
    include: /(?:src|pdf)\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    include: ["jspdf", "html2canvas"],
    esbuildOptions: {
      loader: {
        ".js": "jsx",
      },
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// React comes from the cdnjs UMD build (window.React / window.ReactDOM),
// so JSX compiles to the classic React.createElement runtime.
export default defineConfig({
  plugins: [react({ jsxRuntime: "classic" }), viteSingleFile()],
  build: { outDir: "dist", target: "es2019", modulePreload: false },
});

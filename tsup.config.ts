import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: true,
  treeshake: true,
  splitting: false,
  target: "es2020",
  outDir: "dist",
  onSuccess: "echo 'Build completed successfully!'",
});

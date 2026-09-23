import esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import builtins from "builtin-modules";

const production = process.argv[2] === "production";
const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const context = await esbuild.context({
  absWorkingDir: projectRoot,
  entryPoints: [fileURLToPath(new URL("./src/main.ts", import.meta.url))],
  bundle: true,
  external: ["obsidian", "electron", ...builtins],
  format: "cjs",
  target: "es2022",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: fileURLToPath(new URL("./main.js", import.meta.url)),
  logLevel: "info"
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}

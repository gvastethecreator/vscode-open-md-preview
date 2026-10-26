const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** @type {import('esbuild').Plugin} */
const problemMatcher = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => console.log("[watch] build started"));
    build.onEnd((result) => {
      for (const { text, location } of result.errors) {
        console.error(`✘ [ERROR] ${text}`);
        if (location) console.error(`  ${location.file}:${location.line}:${location.column}:`);
      }
      console.log("[watch] build finished");
    });
  },
};

async function main() {
  const shared = {
    bundle: true,
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    logLevel: "silent",
    plugins: [problemMatcher],
    target: "es2022",
  };
  const contexts = await Promise.all([
    esbuild.context({
      ...shared,
      entryPoints: ["src/extension.ts"],
      external: ["vscode"],
      format: "cjs",
      platform: "node",
      outfile: "dist/node/extension.cjs",
    }),
    esbuild.context({
      ...shared,
      entryPoints: ["src/extension.ts"],
      external: ["vscode"],
      format: "cjs",
      platform: "browser",
      outfile: "dist/web/extension.cjs",
    }),
    esbuild.context({
      ...shared,
      entryPoints: ["src/preview/client.ts"],
      format: "iife",
      globalName: "OpenMdPreviewClient",
      platform: "browser",
      outfile: "dist/preview/client.js",
    }),
  ]);
  if (watch) {
    await Promise.all(contexts.map((context) => context.watch()));
  } else {
    await Promise.all(contexts.map((context) => context.rebuild()));
    await Promise.all(contexts.map((context) => context.dispose()));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

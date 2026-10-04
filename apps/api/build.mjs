// Bundles the API (and the workspace packages it imports as TypeScript) into dist/server.js.
// @google-cloud/firestore stays external: it loads protobuf files at runtime and is installed from the lockfile.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: true,
  external: ['@google-cloud/firestore'],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});

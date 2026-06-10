import { build } from 'esbuild';

const shims = {
  emptyCjs: new URL('./shims/empty-cjs.cjs', import.meta.url).pathname,
  ssh2Agent: new URL('./shims/ssh2-agent.cjs', import.meta.url).pathname,
  nodeFs: new URL('./shims/node-fs.cjs', import.meta.url).pathname,
  nodeNet: new URL('./shims/node-net.cjs', import.meta.url).pathname,
  nodeCrypto: new URL('./shims/node-crypto.mjs', import.meta.url).pathname,
  nodeDns: new URL('./shims/node-dns.mjs', import.meta.url).pathname,
  nodeZlib: new URL('./shims/node-zlib.cjs', import.meta.url).pathname,
  nodeAssert: new URL('./shims/node-assert.cjs', import.meta.url).pathname,
  nodeBuffer: new URL('./shims/node-buffer.mjs', import.meta.url).pathname,
  nodeChildProcess: new URL('./shims/node-child-process.cjs', import.meta.url).pathname,
  nodeEvents: new URL('./shims/node-events.cjs', import.meta.url).pathname,
  nodePath: new URL('./shims/node-path.cjs', import.meta.url).pathname,
  nodeStream: new URL('./shims/node-stream.mjs', import.meta.url).pathname,
  nodeUtil: new URL('./shims/node-util.mjs', import.meta.url).pathname,
  ssh2Sftp: new URL('./shims/ssh2-sftp.cjs', import.meta.url).pathname,
};

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/worker.js',
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  external: [
    'node:*',
    'cloudflare:sockets',
  ],
  plugins: [
    {
      name: 'worker-ssh2-shims',
      setup(build) {
        build.onResolve({ filter: /^cpu-features$/ }, () => ({
          path: shims.emptyCjs,
        }));

        build.onResolve({ filter: /^fs$/ }, () => ({ path: shims.nodeFs }));
        build.onResolve({ filter: /^net$/ }, () => ({ path: shims.nodeNet }));
        build.onResolve({ filter: /^crypto$/ }, () => ({ path: shims.nodeCrypto }));
        build.onResolve({ filter: /^dns$/ }, () => ({ path: shims.nodeDns }));
        build.onResolve({ filter: /^zlib$/ }, () => ({ path: shims.nodeZlib }));
        build.onResolve({ filter: /^assert$/ }, () => ({ path: shims.nodeAssert }));
        build.onResolve({ filter: /^buffer$/ }, () => ({ path: shims.nodeBuffer }));
        build.onResolve({ filter: /^child_process$/ }, () => ({ path: shims.nodeChildProcess }));
        build.onResolve({ filter: /^events$/ }, () => ({ path: shims.nodeEvents }));
        build.onResolve({ filter: /^path$/ }, () => ({ path: shims.nodePath }));
        build.onResolve({ filter: /^stream$/ }, () => ({ path: shims.nodeStream }));
        build.onResolve({ filter: /^util$/ }, () => ({ path: shims.nodeUtil }));

        build.onResolve({ filter: /\.node$/ }, () => ({
          path: shims.emptyCjs,
        }));

        build.onResolve({ filter: /ssh2\/lib\/agent\.js$/ }, () => ({
          path: shims.ssh2Agent,
        }));

        build.onResolve({ filter: /^\.\/agent\.js$/ }, (args) => {
          if (args.importer.endsWith('/node_modules/ssh2/lib/client.js')) {
            return { path: shims.ssh2Agent };
          }

          return undefined;
        });

        build.onResolve({ filter: /^\.\/protocol\/SFTP\.js$/ }, () => ({
          path: shims.ssh2Sftp,
        }));
      },
    },
  ],
});

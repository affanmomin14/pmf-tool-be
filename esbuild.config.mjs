import { build } from 'esbuild';

await build({
  entryPoints: ['src/lambda.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/lambda.js',
  format: 'cjs',
  sourcemap: false,
  minify: false,
  external: [
    'pg-native',
    '@mapbox/node-pre-gyp',
    'bcrypt',
    'mock-aws-s3',
    'aws-sdk',
    'nock',
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react-dom/server',
  ],
});

console.log('Bundle complete → dist/lambda.js');

import { nodeResolve } from '@rollup/plugin-node-resolve'

export default [
  {
    input: 'src/index.js',
    output: [
      /* {
        file: './dist/index.mjs',
        format: 'es'
      },*/
      {
        file: './dist/index.cjs',
        format: 'cjs',
        exports: 'named'
      }
    ],
    plugins: []
  },
  {
    input: 'src/browser.js',
    output: [
      {
        file: './dist/browser.mjs',
        format: 'es'
      }
    ],
    plugins: [nodeResolve()]
  }
]

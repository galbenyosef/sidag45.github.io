// Builds ../index.html (one minified file) from this folder. Requires: npm i terser csso html-minifier-terser
// Usage: node build.mjs [out.html] [--dev]   (--dev keeps the ?snap / ?tilt test hooks)
import { readFileSync, writeFileSync } from 'fs';
import { minify as terser } from 'terser';
import { minify as csso } from 'csso';
import { minify as html } from 'html-minifier-terser';

const dev = process.argv.includes('--dev');
const out = process.argv.slice(2).find(a => !a.startsWith('--')) || '../index.html';
const read = f => readFileSync(new URL(f, import.meta.url), 'utf8');

// GLSL inside template literals: drop // comments, indentation and blank lines (directives keep their own lines)
const glsl = src => src.replace(/`[^`]*`/g, t => /vec[234]|#include|uniform |gl_FragColor/.test(t)
  ? t.split('\n').map(l => l.replace(/\/\/.*$/, '').trim()).filter(Boolean).join('\n') : t);

const art = 'data:image/webp;base64,' + readFileSync(new URL('st-george-mask.webp', import.meta.url)).toString('base64');
const js = async (code, module) => (await terser(code, {
  module, ecma: 2022, toplevel: true,
  compress: { passes: 2, global_defs: { DEV: dev } },
  mangle: true, format: { comments: false },
})).code;

const css = csso(read('styles.css')).css;
const main = await js(read('main.js'), false);
const scene = await js(glsl(read('scene.js')), true);

let page = await html(read('page.html'), { collapseWhitespace: true, removeComments: true, collapseBooleanAttributes: true,
  removeRedundantAttributes: true, removeScriptTypeAttributes: false, sortAttributes: false, minifyJS: false, minifyCSS: false });
page = page
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>${css}</style>`)
  .replace('<script src="main.js"></script>', () => `<script>${main}</script>`)
  .replace('<script type="module" src="scene.js"></script>', () => `<script>self.ST_GEORGE="${art}"</script><script type="module">${scene}</script>`)
  .replace(/<script type="importmap">([\s\S]*?)<\/script>/, (_, m) => `<script type="importmap">${JSON.stringify(JSON.parse(m))}</script>`);
for (const k of ['<style>', '<script>', '<script type="module">']) if (!page.includes(k)) throw new Error('missing ' + k);
writeFileSync(out, page);
console.log(out, (page.length / 1024).toFixed(1) + ' KB');

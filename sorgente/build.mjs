// Impacchetta tutto in un solo file HTML apribile anche offline (doppio clic).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

mkdirSync('dist', { recursive: true });
const js = await build({ entryPoints: ['src/main.js'], bundle: true, loader: { '.webp':'dataurl', '.hdr':'dataurl' }, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none' });
const font = readFileSync('node_modules/@fontsource-variable/archivo/files/archivo-latin-standard-normal.woff2').toString('base64');
const crest = 'data:image/png;base64,' + readFileSync('assets/crest_300.png').toString('base64');
const juve = 'data:image/png;base64,' + readFileSync('assets/juve_crest.png').toString('base64');
const favicon = 'data:image/png;base64,' + readFileSync('assets/favicon.png').toString('base64');
const fontFace = `@font-face{font-family:'Archivo';font-style:normal;font-display:swap;font-weight:100 900;font-stretch:62% 125%;src:url(data:font/woff2;base64,${font}) format('woff2-variations');}`;
const css = readFileSync('src/style.css', 'utf8').replace('/*__FONT__*/', fontFace)
  .replace('__TICKET_BACKGROUND__', 'data:image/webp;base64,' + readFileSync('assets/foro-italico.webp').toString('base64'));
let html = readFileSync('src/index.html', 'utf8');
html = html.replace('/*__CSS__*/', () => css).replaceAll('__CREST__', crest).replaceAll('__FAVICON__', favicon).replaceAll('__JUVE__', juve).replace('/*__JS__*/', () => js.outputFiles[0].text.replace(/<\/script/g, '<\\/script'));
writeFileSync('dist/index.html', html);
console.log('dist/index.html', (html.length / 1024 / 1024).toFixed(2), 'MB');

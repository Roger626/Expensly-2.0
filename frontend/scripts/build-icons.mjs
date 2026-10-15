// Extrae del set Solar (Iconify) solo los íconos que el código usa.
// Busca en src/ cualquier string que coincida con un nombre del set ('…-linear', '…-bold-duotone', …)
// y genera src/app/shared/icon/icons.generated.ts con el tipo IconName.
// Uso: npm run icons  (también corre antes de build)
//      npm start → --serve: regenera al guardar cambios en src/ y lanza ng serve
import { readFileSync, readdirSync, statSync, writeFileSync, watch, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/app/shared/icon/icons.generated.ts');
const set = createRequire(import.meta.url)('@iconify-json/solar/icons.json');

function generate() {
  const files = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|html)$/.test(name) && p !== OUT) files.push(p);
    }
  })(join(ROOT, 'src'));

  const used = new Set();
  const missing = new Set();
  for (const f of files) {
    if (!/(app-icon|icon)/.test(readFileSync(f, 'utf8'))) continue;
    for (const [, name] of readFileSync(f, 'utf8').matchAll(/['"`]([a-z0-9]+(?:-[a-z0-9]+)*-(?:linear|bold-duotone|bold|broken|outline))['"`]/g)) {
      if (set.icons[name] || set.aliases?.[name]) used.add(name);
      else missing.add(name);
    }
  }
  if (missing.size) console.warn('icons: no existen en Solar →', [...missing].join(', '));

  const bodyOf = (name) => set.icons[name]?.body ?? set.icons[set.aliases[name].parent].body;
  const names = [...used].sort();
  const entries = names.map((n) => `  ${JSON.stringify(n)}: ${JSON.stringify(bodyOf(n))},`).join('\n');
  const next =
    `// Generado por scripts/build-icons.mjs a partir de @iconify-json/solar. No editar a mano.\n` +
      `export const ICONS = {\n${entries}\n} as const;\n\nexport type IconName = keyof typeof ICONS;\n`;
  // solo escribe si cambió, para no disparar recompilaciones en bucle
  if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== next) writeFileSync(OUT, next);
  console.log(`icons: ${names.length} → ${OUT.replace(ROOT + '/', '')}`);
}

generate();

if (process.argv.includes('--serve')) {
  let timer;
  watch(join(ROOT, 'src'), { recursive: true }, (_e, file) => {
    if (!file || !/\.(ts|html)$/.test(file) || file.endsWith('icons.generated.ts')) return;
    clearTimeout(timer);
    timer = setTimeout(generate, 150);
  });
  const ng = spawn('npx', ['ng', 'serve', ...process.argv.slice(process.argv.indexOf('--serve') + 1)], { stdio: 'inherit', shell: true });
  ng.on('exit', (code) => process.exit(code ?? 0));
}

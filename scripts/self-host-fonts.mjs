import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../client/public/fonts');
const cssOut = resolve(__dirname, '../client/src/fonts.css');
mkdirSync(outDir, { recursive: true });

let index = 0;
const rules = [];

for (const file of ['/tmp/opencode/fonts1.css', '/tmp/opencode/fonts2.css']) {
  const css = readFileSync(file, 'utf8');
  const blocks = css.match(/@font-face\s*{[^}]+}/g) ?? [];
  for (const block of blocks) {
    const family = block.match(/font-family:\s*'([^']+)'/)?.[1];
    const style = block.match(/font-style:\s*([^;]+);/)?.[1].trim() ?? 'normal';
    const weight = block.match(/font-weight:\s*([^;]+);/)?.[1].trim() ?? '400';
    const unicode = block.match(/unicode-range:\s*([^;]+);/)?.[1].trim() ?? undefined;
    const url = block.match(/url\(([^)]+)\)\s*format\('([^']+)'\)/);
    if (!family || !url) continue;
    index += 1;
    const ext = url[2] === 'truetype' ? 'ttf' : 'woff2';
    const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const filename = `${slug}-${index}.${ext}`;
    rules.push(
      `@font-face {\n  font-family: '${family}';\n  font-style: ${style};\n  font-weight: ${weight};${
        unicode ? `\n  unicode-range: ${unicode};` : ''
      }\n  src: url('/fonts/${filename}') format('${url[2]}');\n}`
    );
    console.log(`downloading ${family} ${weight} ${style} -> ${filename}`);
    const res = await fetch(url[1]);
    if (!res.ok) throw new Error(`fetch failed for ${url[1]}: ${res.status}`);
    writeFileSync(resolve(outDir, filename), Buffer.from(await res.arrayBuffer()));
  }
}

writeFileSync(cssOut, rules.join('\n\n') + '\n');
console.log(`wrote ${rules.length} @font-face rules to ${cssOut}`);
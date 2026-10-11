// =====================================================================================================
// tools/vendor.mjs — kopiuje biblioteki z node_modules do aplikacji ("wendorowanie").
//
// Po co to jest:
//   Aplikacja to Spring Boot serwujący pliki statyczne z src/main/resources/static. NIE używamy CDN (brief §0)
//   ani Node.js w produkcji, więc PixiJS i fonty muszą leżeć w repozytorium jako zwykłe pliki.
//   npm służy tylko do POBRANIA przypiętej wersji; ten skrypt kopiuje z niej to, czego potrzebuje przeglądarka.
//   Wynik (static/vendor/**, static/fonts/**, static/css/fonts.css) commitujemy — aplikacja działa bez npm.
//
// Uruchomienie (raz, albo po zmianie wersji w tools/package.json):
//   cd tools && npm install && npm run vendor
//
// Co powstaje:
//   static/vendor/pixi/pixi.min.mjs   — PixiJS 8 jako moduł ES (import w grach: '../vendor/pixi/pixi.min.mjs')
//   static/vendor/pixi/LICENSE.txt    — licencja MIT PixiJS (wymóg licencji: dołączamy ją razem z kodem)
//   static/vendor/pixi/VERSION.txt    — numer wersji (żeby było widać, co jest w repo)
//   static/fonts/*.woff2              — fonty w podzbiorach latin + latin-ext (latin-ext = polskie znaki ąćęłńśźż)
//   static/fonts/LICENSE-*.txt        — licencje OFL fontów
//   static/css/fonts.css              — reguły @font-face z unicode-range i font-display: swap
// =====================================================================================================

import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const MODULES = path.join(TOOLS, 'node_modules');
const STATIC = path.resolve(TOOLS, '..', 'src', 'main', 'resources', 'static');

/**
 * Fonty marki (brief §1): rodzina z @fontsource → potrzebne grubości.
 * Bierzemy tylko używane grubości, żeby nie wozić zbędnych plików.
 */
const FONTS = [
  { pkg: 'cinzel', family: 'Cinzel', weights: [700, 900], role: 'nagłówki, logotyp' },
  { pkg: 'manrope', family: 'Manrope', weights: [400, 500, 600, 700, 800], role: 'interfejs, liczby (tabular-nums)' },
  { pkg: 'bungee', family: 'Bungee', weights: [400], role: 'S1 Cebulowy 777 (neon retro)' },
  { pkg: 'cinzel-decorative', family: 'Cinzel Decorative', weights: [700, 900], role: 'S2 Złoty Faraon' },
  { pkg: 'marcellus', family: 'Marcellus', weights: [400], role: 'S3 Kryształowa Kaskada' },
];

/** Podzbiory znaków: latin (podstawowy) + latin-ext (polskie litery). Przeglądarka pobiera latin-ext dopiero, gdy na stronie jest np. „ł”. */
const SUBSETS = ['latin', 'latin-ext'];

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function requirePackage(name) {
  const dir = path.join(MODULES, name);
  if (!existsSync(dir)) {
    console.error(`Brak pakietu ${name}. Najpierw uruchom: cd tools && npm install`);
    process.exit(1);
  }
  return dir;
}

/** PixiJS: jeden plik modułu ES + licencja. Mapy źródeł pomijamy (kilka MB, niepotrzebne na obronie). */
async function vendorPixi() {
  const dir = requirePackage('pixi.js');
  const { version } = await readJson(path.join(dir, 'package.json'));
  const out = path.join(STATIC, 'vendor', 'pixi');
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await copyFile(path.join(dir, 'dist', 'pixi.min.mjs'), path.join(out, 'pixi.min.mjs'));
  await copyFile(path.join(dir, 'LICENSE'), path.join(out, 'LICENSE.txt'));
  await writeFile(path.join(out, 'VERSION.txt'), `pixi.js ${version}\n`);
  console.log(`✔ PixiJS ${version} → static/vendor/pixi/`);
}

/** Fonty: kopiuje woff2 i składa fonts.css z unicode-range (zakresy podaje sam pakiet w unicode.json). */
async function vendorFonts() {
  const out = path.join(STATIC, 'fonts');
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  const css = [
    '/* =====================================================================================',
    '   fonts.css — WYGENEROWANE przez tools/vendor.mjs (nie edytuj ręcznie, uruchom: npm run vendor).',
    '   Fonty na licencji SIL OFL 1.1 z pakietów @fontsource, hostowane lokalnie (bez Google Fonts / CDN).',
    '   Dwa podzbiory na każdą grubość: latin i latin-ext. unicode-range sprawia, że przeglądarka pobiera',
    '   latin-ext dopiero wtedy, gdy na stronie pojawi się znak spoza latin (np. polskie „ą”, „ł”).',
    '   font-display: swap — tekst jest widoczny od razu fontem zapasowym, a po wczytaniu podmienia się na właściwy.',
    '   ===================================================================================== */',
    '',
  ];

  let files = 0;
  for (const font of FONTS) {
    const dir = requirePackage(`@fontsource/${font.pkg}`);
    const ranges = await readJson(path.join(dir, 'unicode.json'));
    const available = new Set(await readdir(path.join(dir, 'files')));
    css.push(`/* ${font.family} — ${font.role} */`);
    for (const weight of font.weights) {
      for (const subset of SUBSETS) {
        const file = `${font.pkg}-${subset}-${weight}-normal.woff2`;
        if (!available.has(file)) {
          console.error(`Brak pliku ${file} w @fontsource/${font.pkg}`);
          process.exit(1);
        }
        await copyFile(path.join(dir, 'files', file), path.join(out, file));
        files++;
        css.push(
          '@font-face {',
          `  font-family: '${font.family}';`,
          '  font-style: normal;',
          `  font-weight: ${weight};`,
          '  font-display: swap;',
          `  src: url('../fonts/${file}') format('woff2');`,
          `  unicode-range: ${ranges[subset]};`,
          '}',
        );
      }
    }
    css.push('');
    await copyFile(path.join(dir, 'LICENSE'), path.join(out, `LICENSE-${font.pkg}.txt`));
  }

  await mkdir(path.join(STATIC, 'css'), { recursive: true });
  await writeFile(path.join(STATIC, 'css', 'fonts.css'), css.join('\n'));
  console.log(`✔ ${files} plików woff2 (${FONTS.map((f) => f.family).join(', ')}) → static/fonts/, static/css/fonts.css`);
}

await vendorPixi();
await vendorFonts();
console.log('Gotowe. Wendorowane pliki commitujemy razem z kodem — aplikacja nie potrzebuje npm do działania.');

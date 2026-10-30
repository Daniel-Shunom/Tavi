// Pre-renders the landing page into the built index.html, and starts Tavi's runtime, artwork,
// renderer and fonts loading from the HTML itself instead of from the app script. Runs after
// `vite build`; the studio and overlay still render on the client (index.html hides the landing
// markup on their paths until the app replaces it).
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

const dist = process.argv[2] ?? 'dist';
// Inside the project, so the server bundle resolves React and the rest from node_modules.
const out = join('node_modules', '.tavi-prerender');
try {
  await build({
    logLevel: 'warn',
    build: {
      ssr: 'src/landingPrerender.tsx',
      outDir: out,
      emptyOutDir: true,
      copyPublicDir: false,
    },
  });
  const { render } = await import(pathToFileURL(join(out, 'landingPrerender.js')).href);
  // React writes its image preloads inline; index.html already starts those in the head.
  const markup = render().replace(/^(<link [^>]*\/>)+/, '');

  const assets = await readdir(join(dist, 'assets'));
  const find = (pattern) => {
    const name = assets.find((file) => pattern.test(file));
    if (!name) throw new Error(`No built asset matches ${String(pattern)}`);
    return `/assets/${name}`;
  };
  // Tavi's runtime, artwork and renderer, for the landing page only (the overlay and studio
  // load their own character); the fonts, for every page.
  const tavi = {
    fetch: [find(/^rive-.*\.wasm$/), find(/^tavi-refined-.*\.riv$/)],
    module: find(/^riveRenderer-.*\.js$/),
  };
  const preloads = [
    `<script>
      if (document.documentElement.classList.contains('landing-mode')) {
        for (const href of ${JSON.stringify(tavi.fetch)}) {
          const link = document.createElement('link');
          link.rel = 'preload';
          link.as = 'fetch';
          link.crossOrigin = 'anonymous';
          link.href = href;
          document.head.append(link);
        }
        const module = document.createElement('link');
        module.rel = 'modulepreload';
        module.href = ${JSON.stringify(tavi.module)};
        document.head.append(module);
      }
    </script>`,
    ...[
      'dm-sans-latin-400',
      'dm-sans-latin-500',
      'dm-sans-latin-600',
      'manrope-latin-700',
      'manrope-latin-800',
    ].map(
      (font) =>
        `<link rel="preload" as="font" type="font/woff2" href="${find(new RegExp(`^${font}-normal-.*\.woff2$`))}" crossorigin />`,
    ),
  ];

  const page = join(dist, 'index.html');
  let html = await readFile(page, 'utf8');
  const root = '<div id="root"></div>';
  if (!html.includes(root)) throw new Error('index.html has no empty #root to pre-render into');
  html = html
    .replace(root, `<div id="root">${markup}</div>`)
    .replace('</head>', `    ${preloads.join('\n    ')}\n  </head>`);
  await writeFile(page, html);
  console.log(
    `Pre-rendered the landing page (${String(Math.round(markup.length / 1024))} KB of HTML).`,
  );
} finally {
  await rm(out, { recursive: true, force: true });
}

/**
 * Generates the search-landing pages of the GitHub Pages site and
 * sitemap.xml into both demo/ (local `npx serve demo`)
 * and docs/ (deployed). Run by scripts/build-demo.js.
 *
 * Each page targets one search phrase ("React image editor", …), runs the
 * real editor inline, and links back to the main demo.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIRS = [path.join(ROOT, 'demo'), path.join(ROOT, 'docs')];
const SITE = 'https://rpragesh.github.io/image-editor/';
const NPM = 'https://www.npmjs.com/package/@rageshpikalmunde/rp-image-editor';
const GH = 'https://github.com/rpragesh/image-editor';
const VERSION = require(path.join(ROOT, 'packages/core/package.json')).version;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const PAGES = [
  {
    slug: 'react-image-editor',
    title: 'React Image Editor Component (Open Source) – rp-image-editor',
    description: 'Open-source React image editor: crop, rotate, draw, add text, shapes and callouts, apply filters and edit several images at once. TypeScript, accessible, mobile-ready.',
    h1: 'React image editor',
    lead: 'Add cropping, annotation and filters to your React app with one hook. The editor opens as an accessible full-screen modal and gives you back a File you can upload.',
    install: 'npm install @rageshpikalmunde/rp-image-editor @rageshpikalmunde/rp-image-editor-react',
    code: `import { useRpImageEditor } from '@rageshpikalmunde/rp-image-editor-react';

export function AvatarUpload() {
  const { openEditor, openMultiEditor } = useRpImageEditor();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await openEditor(file, { exportFormat: 'jpeg' });
    if (result) upload(result.file); // File, Blob and base64 are all returned
  }

  return <input type="file" accept="image/*" onChange={onFile} />;
}`,
    extra: 'Prefer it inline? Render <code>&lt;RpImageEditorComponent image={file} onImageEdited={save} /&gt;</code> instead of the modal. Works with Next.js (load it client-side), Vite, CRA and Ionic React.',
    faq: [
      ['Does it work with Next.js?', 'Yes. The editor uses the DOM and canvas, so load it on the client (for example inside <code>useEffect</code> or with <code>next/dynamic</code> and <code>ssr: false</code>).'],
      ['Can users edit several images at once?', 'Yes: <code>openMultiEditor(files)</code> shows a thumbnail strip, keeps separate undo history per image and returns every image with an <code>edited</code> flag.'],
      ['Is it typed?', 'Yes. The packages are written in TypeScript and ship their type definitions.'],
    ],
  },
  {
    slug: 'angular-image-editor',
    title: 'Angular Image Editor (Open Source, Angular 15+) – rp-image-editor',
    description: 'Open-source Angular image editor service and component: crop, rotate, draw, text, shapes, callouts, filters and multi-image editing. AOT-ready, works with Ionic and Capacitor.',
    h1: 'Angular image editor',
    lead: 'An injectable service that opens a full-screen, accessible image editor and resolves with the edited File. Built with Angular Package Format, so it works in AOT and production builds on Angular 15 and newer, including Ionic.',
    install: 'npm install @rageshpikalmunde/rp-image-editor @rageshpikalmunde/rp-image-editor-angular',
    code: `import { Component, inject } from '@angular/core';
import { RpImageEditorService } from '@rageshpikalmunde/rp-image-editor-angular';

@Component({
  selector: 'app-photo-upload',
  standalone: true,
  template: '<input type="file" accept="image/*" (change)="edit($event)" />',
})
export class PhotoUploadComponent {
  private editor = inject(RpImageEditorService);

  async edit(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const result = await this.editor.openEditor(file, { exportFormat: 'jpeg' });
    if (result) this.upload(result.file);
  }
}`,
    extra: 'For an inline editor use <code>&lt;rp-image-editor&gt;</code> from <code>RpImageEditorModule</code>. On Angular 17+ with the esbuild builder, add <code>"externalDependencies": ["jsdom", "canvas"]</code> to <code>angular.json</code>.',
    faq: [
      ['Which Angular versions are supported?', 'Angular 15 and newer, in JIT and AOT builds. Angular SSR is safe: the component only starts in the browser.'],
      ['Does it work with Ionic and Capacitor?', 'Yes. The modal is mobile-first (bottom tool bar, 44&nbsp;px touch targets, pinch to zoom) and iPhone HEIC photos are converted when <code>heic2any</code> is installed.'],
      ['Can I edit a batch of images?', 'Yes: <code>openMultiEditor(files)</code> opens them all with a thumbnail strip and returns one result per image.'],
    ],
  },
  {
    slug: 'image-annotation',
    title: 'JavaScript Image Annotation Library – Arrows, Text, Callouts | rp-image-editor',
    description: 'Annotate images in the browser with plain JavaScript: arrows, shapes, text, callouts and freehand drawing, plus crop and filters. Open source, no framework required, CDN build available.',
    h1: 'Image annotation in JavaScript',
    lead: 'Mark up screenshots, documents and photos in the browser: arrows, rectangles and circles, text, speech-bubble callouts and freehand drawing. Annotations stay attached to the image through crop, rotate and zoom, and export at full resolution.',
    install: 'npm install @rageshpikalmunde/rp-image-editor',
    code: `<!-- No build step: load the CDN bundle -->
<script src="https://unpkg.com/@rageshpikalmunde/rp-image-editor@1/dist/browser/rp-image-editor.min.js"></script>
<input type="file" id="file" accept="image/*">
<script>
  document.getElementById('file').addEventListener('change', async (e) => {
    const result = await RpImageEditor.openEditorModal({
      image: e.target.files[0],
      config: { defaultBrushColor: '#e11d48' },
    });
    if (result) document.body.append(Object.assign(new Image(), { src: result.base64 }));
  });
</script>`,
    extra: 'Need annotations on a page instead of a popup? Create <code>new RpImageEditor.RpImageEditor(container, config)</code> and call <code>getResult()</code> when you save.',
    faq: [
      ['Which annotation tools are included?', 'Freehand draw, eraser, text, arrows, lines, rectangles, squares, circles, ellipses and callouts (a label with a pointer), each with colour and size settings and full undo/redo.'],
      ['Is the exported image full resolution?', 'Yes. Exports are PNG or JPEG at the original image size, with every annotation drawn in.'],
      ['Can I use it without React or Angular?', 'Yes. The core is plain JavaScript/TypeScript, and a single-file CDN build exposes a global <code>RpImageEditor</code>.'],
    ],
  },
];

function page(p) {
  const url = SITE + p.slug + '/';
  const others = PAGES.filter((o) => o !== p);
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: 'rp-image-editor',
      description: p.description,
      url,
      codeRepository: GH,
      programmingLanguage: ['TypeScript', 'JavaScript'],
      runtimePlatform: 'Web browser',
      license: 'https://opensource.org/licenses/MIT',
      version: VERSION,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: p.faq.map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') },
      })),
    },
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(p.title)}</title>
  <meta name="description" content="${esc(p.description)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${esc(p.title)}">
  <meta property="og:description" content="${esc(p.description)}">
  <meta property="og:image" content="${SITE}social-card.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${SITE}social-card.png">
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  <style>
    :root { --text:#14213d; --muted:#4a5568; --line:#d9e2f0; --brand:#2f6fde; --brand-strong:#1f57bb; --bg:#f6f9ff; --card:#fff; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color:var(--text); background:var(--bg); line-height:1.6; }
    a { color: var(--brand-strong); }
    a:focus-visible, button:focus-visible { outline: 3px solid #1d4ed8; outline-offset: 2px; }
    .wrap { max-width: 1040px; margin: 0 auto; padding: 0 16px; }
    header { border-bottom:1px solid var(--line); background:#fff; }
    header .wrap { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:60px; flex-wrap:wrap; }
    header a { text-decoration:none; font-weight:700; }
    nav { display:flex; gap:16px; flex-wrap:wrap; font-size:14px; }
    h1 { font-size: clamp(32px, 5vw, 48px); line-height:1.1; margin: 40px 0 12px; }
    h2 { font-size: 24px; margin: 40px 0 12px; }
    .lead { font-size: 18px; color: var(--muted); max-width: 760px; }
    .editor { height: 560px; border:1px solid var(--line); border-radius: 16px; overflow:hidden; background:#f3f4f7; margin: 24px 0 8px; position:relative; }
    .editor .rp-ie-root { border:0; border-radius:0; }
    .editor-note { font-size:14px; color:var(--muted); display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; }
    .btn { display:inline-block; background:var(--brand); color:#fff; font-weight:700; padding:12px 18px; border-radius:10px; text-decoration:none; border:0; font:inherit; cursor:pointer; }
    .btn:hover { background: var(--brand-strong); }
    pre { background:#0f172a; color:#e2e8f0; padding:16px; border-radius:12px; overflow:auto; font-size:14px; line-height:1.5; }
    .install { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
    .install code { background:#0f172a; color:#e2e8f0; padding:10px 14px; border-radius:10px; font-size:14px; overflow-wrap:anywhere; }
    .features { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px; padding:0; list-style:none; }
    .features li { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
    .features strong { display:block; }
    details { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px 16px; margin:8px 0; }
    summary { font-weight:700; cursor:pointer; }
    footer { margin:56px 0 0; padding:24px 0 40px; border-top:1px solid var(--line); font-size:14px; color:var(--muted); }
    .editor--phone { height: auto; padding: 32px 16px; display: flex; justify-content: center; background: #fff url('../sample.png') center / cover; }
    .editor--phone .btn { box-shadow: 0 8px 24px rgba(15,23,42,.35); }
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <a href="${SITE}">rp-image-editor</a>
      <nav aria-label="Guides">
        ${others.map((o) => `<a href="${SITE}${o.slug}/">${esc(o.h1)}</a>`).join('\n        ')}
        <a href="${SITE}api/">API reference</a>
        <a href="${GH}">GitHub</a>
      </nav>
    </div>
  </header>
  <main class="wrap">
    <h1>${esc(p.h1)}</h1>
    <p class="lead">${p.lead}</p>

    <div class="editor" id="editor" aria-label="Live editor demo"></div>
    <p class="editor-note"><span>This is the real editor (v${VERSION}). Pick a tool and try it.</span><a href="${SITE}#demo">More demos, including multi-image &rarr;</a></p>

    <h2>Install</h2>
    <div class="install"><code>${esc(p.install)}</code></div>

    <h2>Usage</h2>
    <pre tabindex="0" aria-label="Code example"><code>${esc(p.code)}</code></pre>
    <p>${p.extra}</p>

    <h2>What you get</h2>
    <ul class="features">
      <li><strong>Crop, rotate, flip</strong>Aspect-ratio presets, rule-of-thirds guide, keyboard nudging.</li>
      <li><strong>Annotate</strong>Draw, text, arrows, shapes and callouts that stay attached through crop and rotate.</li>
      <li><strong>Filters &amp; adjust</strong>Seven filters with live previews, plus brightness, contrast, saturation and blur.</li>
      <li><strong>Multi-image</strong>Edit a batch with a thumbnail strip and per-image undo.</li>
      <li><strong>Accessible</strong>WCAG 2.2 AA, full keyboard support, focus management.</li>
      <li><strong>Mobile-ready</strong>Bottom tool bar, 44&nbsp;px targets, pinch zoom, HEIC support.</li>
      <li><strong>15 languages</strong>Built-in translations, every string overridable, light and dark themes.</li>
      <li><strong>Full-quality export</strong>PNG or JPEG at the original resolution, as File, Blob or base64.</li>
    </ul>

    <h2>Questions</h2>
    ${p.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join('\n    ')}

    <p style="margin-top:32px"><a class="btn" href="${SITE}#demo">Try the full demo</a> &nbsp; <a href="${NPM}">npm</a> · <a href="${GH}">GitHub</a> · <a href="${SITE}api/">API reference</a></p>
  </main>
  <footer>
    <div class="wrap">rp-image-editor is open source under the MIT license. Built on Fabric.js.</div>
  </footer>
  <script src="../rp-image-editor.bundle.js"></script>
  <script>
    (async () => {
      const host = document.getElementById('editor');
      const sample = async () => (await fetch('../sample.png')).blob();
      // Phones get a button that opens the full-screen editor, so the page
      // still scrolls normally (an inline canvas would capture the swipe).
      if (!window.matchMedia('(min-width: 900px)').matches) {
        host.classList.add('editor--phone');
        host.innerHTML = '<button type="button" class="btn">Open the editor with a sample photo</button>';
        host.querySelector('button').addEventListener('click', async () => {
          RpImageEditor.openEditorModal({ image: await sample(), config: { theme: { variant: 'light' } } });
        });
        return;
      }
      try {
        const editor = new RpImageEditor.RpImageEditor(host, {
          theme: { variant: 'light', headerTitle: 'Photo Editor' },
          keyboardShortcutsScope: 'editor',
        });
        await editor.loadImage(await sample());
      } catch (e) {
        host.textContent = 'The live editor could not load here. Try the main demo.';
      }
    })();
  </script>
</body>
</html>
`;
}

function sitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = ['', ...PAGES.map((p) => p.slug + '/'), 'api/'];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
}

for (const dir of OUT_DIRS) {
  fs.mkdirSync(dir, { recursive: true });
  for (const p of PAGES) {
    fs.mkdirSync(path.join(dir, p.slug), { recursive: true });
    fs.writeFileSync(path.join(dir, p.slug, 'index.html'), page(p));
  }
  fs.writeFileSync(path.join(dir, 'sitemap.xml'), sitemap());
}
console.log('Site pages written: ' + PAGES.map((p) => p.slug).join(', ') + ' (+ sitemap.xml)');

module.exports = { PAGES };

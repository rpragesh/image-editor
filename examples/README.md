# Examples

Standalone projects that install the published npm packages. Open one in StackBlitz, or run it locally.

| Example | StackBlitz | Run locally |
|---|---|---|
| [`react/`](react/): React 18 + Vite, `useRpImageEditor` modal and inline `RpImageEditorComponent` | [Open](https://stackblitz.com/github/rpragesh/image-editor/tree/main/examples/react) | `npm install && npm run dev` |
| [`angular/`](angular/): Angular 17 standalone, `RpImageEditorService` modal and inline `<rp-image-editor>` | [Open](https://stackblitz.com/github/rpragesh/image-editor/tree/main/examples/angular) | `npm install && npm start` |
| [`vanilla-cdn/`](vanilla-cdn/): one HTML file, no build step, CDN `<script>` bundle | [Open](https://stackblitz.com/github/rpragesh/image-editor/tree/main/examples/vanilla-cdn) | open `index.html` (or `npx serve`) |

They are not part of the npm workspace. They use the published versions, not the local source.

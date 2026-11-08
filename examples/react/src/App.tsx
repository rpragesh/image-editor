import { useState, type ChangeEvent } from 'react';
import { RpImageEditorComponent, useRpImageEditor } from '@rageshpikalmunde/rp-image-editor-react';
import type { RpEditorConfig, RpEditorResult } from '@rageshpikalmunde/rp-image-editor';

const SAMPLE = 'https://rpragesh.github.io/image-editor/sample.png';

const config: Partial<RpEditorConfig> = {
  exportFormat: 'jpeg',
  exportQuality: 0.92,
  theme: { headerTitle: 'Edit photo' },
};

export function App() {
  const { openEditor } = useRpImageEditor();
  const [inlineImage, setInlineImage] = useState<string | null>(null);
  const [result, setResult] = useState<RpEditorResult | null>(null);

  // 1. Modal: resolves with the result on Apply, or null on Close.
  async function openModal(image: File | string) {
    const edited = await openEditor(image, config);
    if (edited) setResult(edited);
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) openModal(file);
  }

  return (
    <main>
      <h1>rp-image-editor · React</h1>

      <h2>1. Modal (useRpImageEditor)</h2>
      <p>Pick a photo, or use the sample, to open the editor full-screen.</p>
      <div className="actions">
        <label className="btn">
          Choose image
          <input type="file" accept="image/*,.heic,.heif" onChange={onFile} hidden />
        </label>
        <button className="btn secondary" onClick={() => openModal(SAMPLE)}>
          Edit the sample
        </button>
      </div>

      {/* 2. Inline: the editor's own Apply button calls onImageEdited. */}
      <h2>2. Inline (RpImageEditorComponent)</h2>
      {inlineImage ? (
        <>
          <div className="inline-host">
            <RpImageEditorComponent
              image={inlineImage}
              config={config}
              onImageEdited={setResult}
              onError={(err) => console.error('Editor error', err)}
            />
          </div>
          <div className="actions">
            <button className="btn secondary" onClick={() => setInlineImage(null)}>
              Close inline editor
            </button>
          </div>
        </>
      ) : (
        <button className="btn secondary" onClick={() => setInlineImage(SAMPLE)}>
          Show inline editor
        </button>
      )}

      {result && (
        <section>
          <h2>
            Result · {result.width} × {result.height}
          </h2>
          <img src={result.base64} alt="Edited image" />
        </section>
      )}
    </main>
  );
}

// PDF rendering components — requires PDF.js loaded globally as pdfjsLib
// PdfThumbnail: first-page preview (blob URL only, used in upload modal)
// PdfViewer:    <iframe> with #navpanes=0, custom page-nav for multi-page

const { useState: useStatePdf, useEffect: useEffectPdf, useRef: useRefPdf } = React;

/* ─────────────────────────────────────────────────────────────
   PdfThumbnail
   Used in upload modal where the file is still a local blob —
   no CORS issues. For the grid, AssetTile uses asset.thumbnailUrl
   directly as <img>, so this component is only a safety net.
───────────────────────────────────────────────────────────── */
function PdfThumbnail({ url, hue = 25, label = "PDF" }) {
  const [dataUrl, setDataUrl] = useStatePdf(null);
  const [failed,  setFailed]  = useStatePdf(false);

  useEffectPdf(() => {
    if (!url || !url.startsWith('blob:') || !window.pdfjsLib) { setFailed(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const resp   = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data   = new Uint8Array(await resp.arrayBuffer());
        if (cancelled) return;
        const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) return;
        const page     = await pdfDoc.getPage(1);
        const vp       = page.getViewport({ scale: 1 });
        const scaledVp = page.getViewport({ scale: 480 / vp.width });
        const canvas   = document.createElement('canvas');
        canvas.width   = scaledVp.width;
        canvas.height  = scaledVp.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaledVp }).promise;
        if (!cancelled) setDataUrl(canvas.toDataURL('image/jpeg', 0.82));
      } catch (err) {
        console.error('[PdfThumbnail]', err);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (dataUrl) return (
    <div style={{ position: 'absolute', inset: 0, background: '#fff', overflow: 'hidden' }}>
      <img src={dataUrl} draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  );
  return <window.PHDark hue={hue} label={label} />;
}

/* ─────────────────────────────────────────────────────────────
   PdfViewer
   Props:
     url   — Firebase Storage download URL
     lang  — 'de' | 'en'
     pages — total page count (default 1)

   Single-page  → iframe fills full height, sidebar hidden via
                  #navpanes=0, Chrome toolbar visible for zoom.
   Multi-page   → iframe fills full height, sidebar hidden,
                  custom prev/next controls at the bottom so
                  the sidebar never takes up space.

   Page navigation trick: we hold `currentPage` in state and
   recreate the iframe src on each change. Chrome reloads the
   PDF on src change, but the file is cached by the browser
   after the first load so subsequent page jumps are fast.
───────────────────────────────────────────────────────────── */
function PdfViewer({ url, lang, pages = 1 }) {
  const [currentPage, setCurrentPage] = useStatePdf(1);
  const isDe = lang === 'de';

  // Reset page when asset changes
  useEffectPdf(() => { setCurrentPage(1); }, [url]);

  // Keyboard navigation for multi-page
  useEffectPdf(() => {
    if (pages <= 1) return;
    function onKey(e) {
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   setCurrentPage(p => Math.max(1, p - 1));
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setCurrentPage(p => Math.min(pages, p + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pages]);

  if (!url) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
      {isDe ? 'Keine URL verfügbar.' : 'No URL available.'}
    </div>
  );

  // Append fragment params:
  // #navpanes=0  → hide Chrome's thumbnail sidebar
  // &view=Fit    → fit entire page to viewport on load (longest side fills the iframe)
  // &page=N      → jump to page N on load
  const iframeSrc = url + `#navpanes=0&view=Fit${pages > 1 ? `&page=${currentPage}` : ''}`;

  const iconBtn = (disabled) => ({
    all: 'unset', cursor: disabled ? 'not-allowed' : 'pointer',
    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid var(--line-strong)',
    color: disabled ? 'var(--faint)' : 'var(--fg)',
    background: 'var(--panel)', flexShrink: 0,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* PDF iframe — full remaining height, no sidebar */}
      <iframe
        key={iframeSrc}           /* force remount on page change */
        src={iframeSrc}
        style={{ flex: 1, border: 'none', width: '100%', minHeight: 0, display: 'block', background: 'var(--bg)' }}
        title="PDF"
        allowFullScreen
      />

      {/* Bottom bar: page nav (multi-page only) + download */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: pages > 1 ? 'space-between' : 'flex-end',
        padding: '8px 16px', borderTop: '1px solid var(--line)',
        background: 'var(--panel)', gap: 8,
      }}>

        {/* Page navigation — only for multi-page PDFs */}
        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              style={iconBtn(currentPage <= 1)}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              title={isDe ? 'Vorherige Seite' : 'Previous page'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-2)', minWidth: 54, textAlign: 'center' }}>
              {currentPage} / {pages}
            </span>
            <button
              style={iconBtn(currentPage >= pages)}
              onClick={() => setCurrentPage(p => Math.min(pages, p + 1))}
              disabled={currentPage >= pages}
              title={isDe ? 'Nächste Seite' : 'Next page'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        )}

        {/* Download / open in new tab */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            all: 'unset', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', border: '1px solid var(--line-strong)',
            fontSize: 12, color: 'var(--fg)', fontFamily: 'var(--font-sans)',
            background: 'var(--panel)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--panel)'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {isDe ? 'In neuem Tab öffnen' : 'Open in new tab'}
        </a>
      </div>
    </div>
  );
}

window.PdfThumbnail = PdfThumbnail;
window.PdfViewer    = PdfViewer;

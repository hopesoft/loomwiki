import { useEffect, useId, useRef, useState } from 'react';
import type { Citation } from '../shared/knowledge';
import type { SourceDetail } from '../shared/source';

function CitationReference({ citation }: { citation: Citation }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<SourceDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const panel = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (open) panel.current?.focus(); }, [open]);
  async function inspect() {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setOpen(true); setLoading(true); setSource(null); setError('');
    try {
      const response = await fetch('/api/sources/' + citation.sourceId, { signal: request.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to read the original source.');
      if (!request.signal.aborted) setSource(result);
    } catch (error) {
      if (!request.signal.aborted) setError(error instanceof Error ? error.message : 'Unable to read the original source.');
    } finally { if (!request.signal.aborted) setLoading(false); }
  }
  function close() {
    controller.current?.abort(); setOpen(false); setLoading(false); trigger.current?.focus();
  }
  return <blockquote><p>{citation.quote}</p>
    <button type="button" className="text-button" ref={trigger} aria-expanded={open} aria-controls={panelId} onClick={() => open ? close() : void inspect()}>{open ? 'Close original' : 'Inspect original ↗'}</button>
    {open ? <section className="inline-original" id={panelId} ref={panel} tabIndex={-1} aria-label="Original source" aria-busy={loading}>
      {loading ? <p role="status">Loading original source…</p> : null}
      {error ? <div role="alert"><p>{error}</p><button type="button" className="text-button" onClick={() => void inspect()}>Retry original</button></div> : null}
      {source ? <><h4>{source.filename}</h4><p className="muted">Full preserved source · Read only</p><pre>{source.text}</pre><details><summary>Source integrity</summary><code>{source.sha256}</code></details></> : null}
    </section> : null}
  </blockquote>;
}
export function Evidence({ citations }: { citations: Citation[] }) {
  return <details className="evidence"><summary>{citations.length} source {citations.length === 1 ? 'reference' : 'references'}</summary>{citations.map((citation, index) => <CitationReference key={`${citation.sourceId}:${citation.quote}:${index}`} citation={citation}/>)}</details>;
}

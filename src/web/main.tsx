import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Source, SourceDetail } from '../shared/source';
import type { Claim, Conflict, Proposal, Revision, Workspace } from '../shared/knowledge';
import './style.css';
import { Evidence } from './Evidence';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? 'Request failed.');
  return value;
}
function Content({ claims, conflicts }: { claims: Claim[]; conflicts: Conflict[] }) {
  return <>{claims.map((claim, index) => <section className="claim" key={index}><p>{claim.text}</p><Evidence citations={claim.citations}/></section>)}{conflicts.length ? <section className="conflicts"><h3>Unresolved perspectives</h3><p className="muted">These disagreements remain visible, including after acceptance.</p>{conflicts.map((conflict, index) => <div key={index}><p>{conflict.description}</p><Evidence citations={conflict.citations}/></div>)}</section> : null}</>;
}
const initial: Workspace = { pages: [], proposals: [], runs: [], provider: { configured: false, label: 'Not configured', destination: null } };
function App() {
  const [tab, setTab] = useState<'Knowledge' | 'Inbox' | 'Review'>('Knowledge');
  const [workspace, setWorkspace] = useState(initial);
  const [sources, setSources] = useState<Source[]>([]);
  const [source, setSource] = useState<SourceDetail | null>(null);
  const [pageId, setPageId] = useState('');
  const [proposalId, setProposalId] = useState('');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<Revision[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [paste, setPaste] = useState(false);
  const [filename, setFilename] = useState('notes.md');
  const [body, setBody] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const selection = useRef(0);
  const pending = workspace.proposals.filter(item => item.status === 'pending');
  const page = workspace.pages.find(item => item.id === pageId);
  const proposal = workspace.proposals.find(item => item.id === proposalId);
  const processing = workspace.runs.some(run => run.status === 'running');
  async function refresh() {
    const [nextWorkspace, nextSources] = await Promise.all([request<Workspace>('/api/workspace'), request<Source[]>('/api/sources')]);
    setWorkspace(nextWorkspace); setSources(nextSources);
  }
  useEffect(() => { void refresh().catch(error => setError(error.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => { void refresh().catch(error => setError(error.message)); }, 3000);
    return () => clearInterval(timer);
  }, [processing]);
  async function action(work: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  async function selectSource(id: string) {
    const current = ++selection.current;
    try { const next = await request<SourceDetail>('/api/sources/' + id); if (current === selection.current) setSource(next); }
    catch (error) { if (current === selection.current) setError((error as Error).message); }
  }
  async function upload(file?: File) {
    if (!file) return;
    await action(async () => {
      if (file.size > 1024 * 1024) throw new Error('Choose a Markdown file up to 1 MiB.');
      const imported = await request<SourceDetail>('/api/sources', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name) }, body: file });
      ++selection.current; setSource(imported); setTab('Inbox'); setPaste(false); await refresh();
      setNotice('Source saved locally. Process it when you are ready to send it to the model.');
    });
    if (input.current) input.current.value = '';
  }
  async function processSource() {
    if (!source) return;
    await action(async () => {
      const suggested = await request<Proposal>('/api/process/' + source.id, { method: 'POST' });
      setProposalId(suggested.id); setNote(''); setTab('Review'); await refresh(); setNotice('Suggestion ready. Your knowledge has not changed.');
    });
    await refresh().catch(error => setError(error.message));
  }
  async function review(actionName: 'accept' | 'reject') {
    if (!proposal) return;
    await action(async () => {
      await request('/api/review/' + proposal.id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: actionName, note }) });
      await refresh(); setNotice(actionName === 'accept' ? 'Accepted. The page and its revision history were saved together.' : 'Rejected. Your knowledge is unchanged.');
    });
  }
  function navigate(next: typeof tab) { ++selection.current; setTab(next); setError(''); setNotice(''); }
  return <div className="workspace">
    <aside className="sidebar"><a className="brand" href="/">LoomWiki<span>Knowledge, thoughtfully maintained.</span></a>
      <nav className="main-nav" aria-label="Workspace">{(['Knowledge', 'Inbox', 'Review'] as const).map(name => <button disabled={busy} key={name} onClick={() => navigate(name)} className={tab === name ? 'active' : ''}><span>{name}</span><small>{name === 'Knowledge' ? workspace.pages.length : name === 'Inbox' ? sources.length : pending.length}</small></button>)}</nav>
      <div className="sidebar-note"><span className="eyebrow">THE WAY IT WORKS</span><p>You bring the sources.<br/>AI suggests the changes.<br/>You decide what stays.</p></div>
      <footer><span className="local-dot"/> Local workspace<p>{workspace.provider.configured ? workspace.provider.label : 'AI is not configured'}</p></footer>
    </aside>
    <main><header><span>{tab}</span><span className="badge">HUMAN-REVIEWED KNOWLEDGE</span></header>
      {error ? <div role="alert" className="error">{error}<button className="text-button" disabled={busy} onClick={() => void action(refresh)}>Refresh workspace</button></div> : null}
      {notice ? <p role="status" className="notice">{notice}</p> : null}
      {loading ? <p role="status">Loading your workspace…</p> : null}
      {!loading && tab === 'Knowledge' ? <>
        <div className="page-heading"><div><span className="eyebrow">YOUR LIVING LIBRARY</span><h1>Knowledge worth keeping.</h1><p>Accepted ideas, connected to the evidence behind them.</p></div><button onClick={() => navigate('Inbox')}>Add a source ↗</button></div>
        {workspace.pages.length ? <div className="split"><div className="item-list">{workspace.pages.map(item => <button disabled={busy} key={item.id} className={pageId === item.id ? 'selected' : ''} onClick={() => { setPageId(item.id); setHistory(null); }}><strong>{item.title}</strong><small>Revision {item.revision} · {item.claims.length} statements</small></button>)}</div><div>{page ? <article><span className="eyebrow">ACCEPTED · REVISION {page.revision}</span><h2>{page.title}</h2><Content claims={page.claims} conflicts={page.conflicts}/><button className="text-button" disabled={busy} onClick={() => void action(async () => setHistory(await request<Revision[]>('/api/history/' + page.id)))}>View revision history</button>{history ? <section className="history"><h3>Revision history</h3>{history.map(revision => <details key={revision.revision}><summary>Revision {revision.revision} · {new Date(revision.createdAt).toLocaleString()}</summary><p>{revision.reviewNote || 'Accepted without a review note.'}</p><h4>{revision.snapshot.title}</h4><Content claims={revision.snapshot.claims} conflicts={revision.snapshot.conflicts}/></details>)}</section> : null}</article> : <p className="muted">Select a page to read it.</p>}</div></div> : <section className="empty"><span className="thread" aria-hidden="true">⌁</span><h2>A library that grows<br/>with what you learn.</h2><p>Add your first source in Inbox. AI will propose a page for you to review. Nothing enters your knowledge base without your approval.</p><button onClick={() => navigate('Inbox')}>Go to Inbox →</button></section>}
      </> : null}
      {!loading && tab === 'Inbox' ? <>
        <div className="page-heading"><div><span className="eyebrow">FROM INFORMATION TO UNDERSTANDING</span><h1>Bring something in.</h1><p>Keep the original. Let AI work out where it belongs.</p></div><div className="actions"><button disabled={busy} onClick={() => input.current?.click()}>Import Markdown</button><button className="secondary" disabled={busy} onClick={() => setPaste(!paste)}>Paste text</button></div></div>
        <input ref={input} type="file" accept=".md,.markdown" hidden onChange={event => void upload(event.target.files?.[0])}/>
        {paste ? <form className="paste-form" onSubmit={event => { event.preventDefault(); void upload(new File([body], filename, { type: 'text/markdown' })); }}><label>Source filename<input required value={filename} onChange={event => setFilename(event.target.value)}/></label><label>Source text<textarea required rows={8} value={body} onChange={event => setBody(event.target.value)}/></label><button disabled={busy || !body.trim()}>Save source locally</button></form> : null}
        {!workspace.provider.configured ? <section className="setup"><h3>Connect a model to start maintaining knowledge</h3><p>Copy <code>.env.example</code> to <code>.env</code>, add your API key in the local file, and restart the server. Your key never goes into the browser.</p><p>Import and inspect sources now. AI processing becomes available after configuration.</p></section> : null}
        <div className="split"><div className="item-list">{sources.length ? sources.map(item => { const run = workspace.runs.find(run => run.sourceId === item.id); const suggestion = workspace.proposals.find(proposal => proposal.sourceId === item.id); return <button disabled={busy} key={item.id} className={source?.id === item.id ? 'selected' : ''} onClick={() => void selectSource(item.id)}><strong>{item.filename}</strong><small>{run?.status === 'running' ? 'Processing…' : run?.status === 'failed' ? 'Processing failed' : suggestion ? suggestion.status === 'pending' ? 'Awaiting review' : suggestion.status : 'Ready to process'} · {item.sha256.slice(0, 8)}</small></button>; }) : <p className="muted">No sources yet. Import a Markdown file or paste text above.</p>}</div><div>{source ? <article><span className="eyebrow">PRESERVED SOURCE</span><h2>{source.filename}</h2><p className="muted">{source.byteLength.toLocaleString()} bytes · Imported {new Date(source.importedAt).toLocaleString()}</p><section className="process-panel"><h3>Suggest a knowledge update</h3><p>{workspace.provider.configured ? <>Sends this source and up to 20 current knowledge pages, including their evidence, to <strong>{workspace.provider.destination}</strong> using {workspace.provider.label}. The result waits for your review.</> : 'Configure a model on the backend to process this source.'}</p><button disabled={busy || processing || !workspace.provider.configured || pending.some(item => item.sourceId === source.id)} onClick={() => void processSource()}>{busy || processing ? 'Working…' : 'Send to AI & prepare review'}</button>{workspace.runs.find(run => run.sourceId === source.id)?.error ? <p className="error">{workspace.runs.find(run => run.sourceId === source.id)?.error}</p> : null}</section><details><summary>Source integrity</summary><code>{source.sha256}</code><p>SHA-256 verified on read. Different content creates a separate artifact.</p></details><pre>{source.text}</pre></article> : <p className="muted">Select a source to inspect it and prepare an update.</p>}</div></div>
      </> : null}
      {!loading && tab === 'Review' ? <>
        <div className="page-heading"><div><span className="eyebrow">YOU HAVE THE FINAL WORD</span><h1>Review what changes.</h1><p>Check the proposal, follow its evidence, then decide.</p></div><span>{pending.length} awaiting review</span></div>
        <div className="item-list review-list">{workspace.proposals.map(item => <button disabled={busy} key={item.id} className={proposalId === item.id ? 'selected' : ''} onClick={() => { setProposalId(item.id); setNote(''); }}><strong>{item.title}</strong><small>{item.targetPageId ? 'Update page' : 'New page'} · {item.status}{item.conflicts.length ? ` · ${item.conflicts.length} disagreement(s)` : ''}</small></button>)}</div>
        {proposal ? <article><div className="review-summary"><span className="eyebrow">{proposal.status.toUpperCase()} · {proposal.model}</span><h2>{proposal.title}</h2><p>{proposal.summary}</p><p className="muted">Quotes are checked against the originals. You still need to judge whether they support each statement.</p></div><div className="comparison"><section><h3>Before</h3>{proposal.before ? <><h4>{proposal.before.title}</h4><Content claims={proposal.before.claims} conflicts={proposal.before.conflicts}/></> : <p className="muted">A new page. Nothing is being replaced.</p>}</section><section><h3>Proposed</h3><Content claims={proposal.claims} conflicts={proposal.conflicts}/></section></div>{proposal.status === 'pending' ? <form className="review-actions" onSubmit={event => { event.preventDefault(); void review('accept'); }}><label>{proposal.conflicts.length ? 'Your decision on the disagreement (required)' : 'Review note (optional)'}<textarea maxLength={2000} rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder={proposal.conflicts.length ? 'Explain what should remain unresolved or how you interpret the difference.' : 'Why are you accepting or rejecting this change?'}/></label><div className="actions"><button disabled={busy || (!!proposal.conflicts.length && !note.trim())}>Accept update</button><button type="button" className="secondary" disabled={busy} onClick={() => void review('reject')}>Reject suggestion</button></div><p className="muted">Acceptance preserves both the previous revision and the evidence. Flagged disagreements remain visible.</p></form> : <p className="notice">{proposal.status === 'accepted' ? 'Accepted into Knowledge.' : 'Rejected. Knowledge was not changed.'} {proposal.reviewNote}</p>}</article> : <section className="empty"><h2>{workspace.proposals.length ? 'Choose a suggestion.' : 'Nothing waiting for your review.'}</h2><p>Process a source in Inbox to prepare a proposed knowledge update.</p><button onClick={() => navigate('Inbox')}>Go to Inbox →</button></section>}
      </> : null}
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);

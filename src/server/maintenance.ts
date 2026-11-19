import type { Citation, Draft, Page } from '../shared/knowledge';
import { KnowledgeStore } from './knowledge';
import { SourceStore, InputError } from './store';
import type { Maintainer } from './provider';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('The suggestion has an invalid structure.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 6000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new InputError('The suggestion contains an invalid text field.');
  return value;
}
function array(value: unknown, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new InputError('The suggestion contains an invalid list.');
  return value;
}
export async function validateDraft(value: unknown, selectedSource: string, pages: Page[], sources: SourceStore): Promise<Draft> {
  const data = object(value);
  const targetPageId = data.targetPageId === null ? null : text(data.targetPageId, 100);
  const before = pages.find(page => page.id === targetPageId);
  if (targetPageId && !before) throw new InputError('The model selected a page outside the provided context.');
  const allowed = new Set([selectedSource]);
  for (const page of before ? [before] : []) for (const item of [...page.claims, ...page.conflicts]) for (const citation of item.citations) allowed.add(citation.sourceId);
  const cache = new Map<string, string>();
  let usesSelected = false;
  async function citations(value: unknown): Promise<Citation[]> {
    const result: Citation[] = [];
    for (const raw of array(value, 1, 8)) {
      const citation = object(raw); const sourceId = text(citation.sourceId, 64); const quote = text(citation.quote, 4000);
      if (!allowed.has(sourceId)) throw new InputError('The suggestion cites a source outside its context.');
      if (!cache.has(sourceId)) cache.set(sourceId, (await sources.read(sourceId)).text);
      if (!cache.get(sourceId)!.includes(quote)) throw new InputError('A quoted passage does not match its original source. Nothing was changed.');
      if (sourceId === selectedSource) usesSelected = true;
      result.push({ sourceId, quote });
    }
    return result;
  }
  const claims = [];
  for (const raw of array(data.claims, 1, 30)) { const claim = object(raw); claims.push({ text: text(claim.text), citations: await citations(claim.citations) }); }
  const conflicts = [];
  for (const raw of array(data.conflicts, 0, 10)) {
    const conflict = object(raw); const refs = await citations(conflict.citations);
    if (new Set(refs.map(ref => ref.sourceId)).size < 2) throw new InputError('A conflict must cite at least two sources.');
    conflicts.push({ description: text(conflict.description), citations: refs });
  }
  if (!usesSelected) throw new InputError('The suggestion does not cite the selected source.');
  return { targetPageId, title: text(data.title, 200), summary: text(data.summary, 2000), claims, conflicts };
}
export class Maintenance {
  constructor(readonly knowledge: KnowledgeStore, readonly sources: SourceStore, private readonly provider: Maintainer | null) {}
  status() { return { configured: !!this.provider, label: this.provider?.label ?? 'Not configured', destination: this.provider?.destination ?? null }; }
  async process(sourceId: string) {
    if (!this.provider) throw new InputError('Configure the backend model connection before processing a source.');
    const source = await this.sources.read(sourceId);
    const pages = this.knowledge.pages();
    if (pages.length > 20 || JSON.stringify({ source, pages }).length > 60000) throw new InputError('This demo supports up to 20 pages and 60,000 context characters per request. No request was sent.');
    const run = this.knowledge.startRun(sourceId);
    try {
      const value = await this.provider.suggest(source, pages, AbortSignal.timeout(60000));
      const draft = await validateDraft(value, sourceId, pages, this.sources);
      const proposal = this.knowledge.propose(sourceId, draft, pages.find(page => page.id === draft.targetPageId) ?? null, this.provider.label);
      this.knowledge.finishRun(run.id, 'completed'); return proposal;
    } catch (error) {
      const message = error instanceof InputError ? error.message : 'Processing failed or timed out. Your source and knowledge pages are unchanged. Retry when ready.';
      this.knowledge.finishRun(run.id, 'failed', message); throw new InputError(message);
    }
  }
  async review(id: string, action: 'accept' | 'reject', note: string) {
    const proposal = this.knowledge.proposals().find(item => item.id === id);
    if (!proposal) throw new InputError('Suggestion not found.');
    // Check preserved evidence again before accepting a proposal stored earlier.
    if (action === 'accept') await validateDraft(proposal, proposal.sourceId, proposal.before ? [proposal.before] : this.knowledge.pages(), this.sources);
    return this.knowledge.review(id, action, note);
  }
}

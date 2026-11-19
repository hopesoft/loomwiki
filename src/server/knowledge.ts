import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import type { Draft, Page, Proposal, Revision, Run } from '../shared/knowledge';
import { InputError } from './store';

export class KnowledgeStore {
  private db: DatabaseSync;
  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS pages(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY, status TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS revisions(page_id TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(page_id,revision));
      CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, source_id TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL);`);
    // A new process must not silently retry a request whose outcome is unknown.
    for (const run of this.runs().filter(run => run.status === 'running')) this.finishRun(run.id, 'failed', 'Processing was interrupted. Review existing suggestions before retrying.');
  }
  close() { this.db.close(); }
  pages(): Page[] { return this.db.prepare('SELECT data FROM pages ORDER BY rowid DESC').all().map(row => JSON.parse(row.data as string)); }
  proposals(): Proposal[] { return this.db.prepare('SELECT data FROM proposals ORDER BY rowid DESC').all().map(row => JSON.parse(row.data as string)); }
  runs(): Run[] { return this.db.prepare('SELECT data FROM runs ORDER BY rowid DESC').all().map(row => JSON.parse(row.data as string)); }
  history(pageId: string): Revision[] { return this.db.prepare('SELECT data FROM revisions WHERE page_id=? ORDER BY revision DESC').all(pageId).map(row => JSON.parse(row.data as string)); }
  startRun(sourceId: string): Run {
    if (this.runs().some(run => run.status === 'running')) throw new InputError('Another source is being processed. Please wait.');
    if (this.proposals().some(proposal => proposal.sourceId === sourceId && proposal.status === 'pending')) throw new InputError('This source already has a suggestion awaiting review.');
    const run: Run = { id: randomUUID(), sourceId, status: 'running', error: null, createdAt: new Date().toISOString() };
    this.db.prepare('INSERT INTO runs VALUES(?,?,?,?)').run(run.id, sourceId, run.status, JSON.stringify(run));
    return run;
  }
  finishRun(id: string, status: 'completed' | 'failed', error: string | null = null) {
    const row = this.db.prepare('SELECT data FROM runs WHERE id=?').get(id);
    if (!row) throw new Error('Missing processing run.');
    const run: Run = { ...JSON.parse(row.data as string), status, error };
    this.db.prepare('UPDATE runs SET status=?,data=? WHERE id=?').run(status, JSON.stringify(run), id);
  }
  propose(sourceId: string, draft: Draft, before: Page | null, model: string): Proposal {
    const proposal: Proposal = { ...draft, id: randomUUID(), sourceId, baseRevision: before?.revision ?? 0, before, status: 'pending', createdAt: new Date().toISOString(), reviewedAt: null, reviewNote: '', model };
    this.db.prepare('INSERT INTO proposals VALUES(?,?,?)').run(proposal.id, proposal.status, JSON.stringify(proposal));
    return proposal;
  }
  review(id: string, action: 'accept' | 'reject', note: string): Proposal {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.prepare('SELECT data FROM proposals WHERE id=?').get(id);
      if (!row) throw new InputError('Suggestion not found.');
      const proposal: Proposal = JSON.parse(row.data as string);
      if (proposal.status !== 'pending') throw new InputError('This suggestion has already been reviewed.');
      if (action === 'accept') {
        if (proposal.conflicts.length && !note.trim()) throw new InputError('Explain how you want to retain or resolve the flagged disagreement.');
        const current = proposal.targetPageId ? this.db.prepare('SELECT revision FROM pages WHERE id=?').get(proposal.targetPageId) : null;
        if (proposal.targetPageId && (!current || current.revision !== proposal.baseRevision)) throw new InputError('This page changed after the suggestion was created. Reject this suggestion and process the source again.');
        const page: Page = { id: proposal.targetPageId ?? randomUUID(), revision: proposal.baseRevision + 1, title: proposal.title, claims: proposal.claims, conflicts: proposal.conflicts, updatedAt: new Date().toISOString() };
        const revision: Revision = { pageId: page.id, revision: page.revision, snapshot: page, proposalId: proposal.id, reviewNote: note.trim(), createdAt: page.updatedAt };
        this.db.prepare('INSERT INTO pages VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data').run(page.id, page.revision, JSON.stringify(page));
        this.db.prepare('INSERT INTO revisions VALUES(?,?,?)').run(page.id, page.revision, JSON.stringify(revision));
      }
      proposal.status = action === 'accept' ? 'accepted' : 'rejected'; proposal.reviewedAt = new Date().toISOString(); proposal.reviewNote = note.trim();
      this.db.prepare('UPDATE proposals SET status=?,data=? WHERE id=?').run(proposal.status, JSON.stringify(proposal), id);
      this.db.exec('COMMIT'); return proposal;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
}

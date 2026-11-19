export interface Citation { sourceId: string; quote: string }
export interface Claim { text: string; citations: Citation[] }
export interface Conflict { description: string; citations: Citation[] }
export interface Draft { targetPageId: string | null; title: string; summary: string; claims: Claim[]; conflicts: Conflict[] }
export interface Page { id: string; revision: number; title: string; claims: Claim[]; conflicts: Conflict[]; updatedAt: string }
export interface Proposal extends Draft { id: string; sourceId: string; baseRevision: number; before: Page | null; status: 'pending' | 'accepted' | 'rejected'; createdAt: string; reviewedAt: string | null; reviewNote: string; model: string }
export interface Run { id: string; sourceId: string; status: 'running' | 'completed' | 'failed'; error: string | null; createdAt: string }
export interface Revision { pageId: string; revision: number; snapshot: Page; proposalId: string; reviewNote: string; createdAt: string }
export interface Workspace { pages: Page[]; proposals: Proposal[]; runs: Run[]; provider: { configured: boolean; label: string; destination: string | null } }

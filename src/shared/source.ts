export interface Source {
  id: string;
  filename: string;
  sha256: string;
  importedAt: string;
  byteLength: number;
}
export interface SourceDetail extends Source { text: string }

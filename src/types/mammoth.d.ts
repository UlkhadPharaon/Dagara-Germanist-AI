/**
 * Minimal type surface for the `mammoth` DOCX reader (ships no declarations).
 * Only the client-side raw-text extraction used by Phase 2/Phase 3 is declared.
 */
declare module 'mammoth' {
  export interface ExtractRawTextOptions {
    arrayBuffer: ArrayBuffer;
    path?: string;
  }

  export interface ExtractRawTextResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  export function extractRawText(options: ExtractRawTextOptions): Promise<ExtractRawTextResult>;
}

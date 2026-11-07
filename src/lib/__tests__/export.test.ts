import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportToWord } from '../export';

/**
 * The Word export builds a downloadable .doc blob. It is verified by
 * intercepting the anchor click instead of writing to disk.
 */

let createdUrls: string[];
let revokedUrls: string[];
let capturedBlob: Blob | null;
let clickSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  createdUrls = [];
  revokedUrls = [];
  capturedBlob = null;
  clickSpy = vi.fn();

  // jsdom implements neither URL.createObjectURL nor object URLs.
  URL.createObjectURL = (blob: Blob) => {
    capturedBlob = blob;
    const url = `blob:mock/${createdUrls.length}`;
    createdUrls.push(url);
    return url;
  };
  URL.revokeObjectURL = (url: string) => {
    revokedUrls.push(url);
  };

  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const lastBlob = (): Blob => {
  if (!capturedBlob) throw new Error('Aucun blob créé par exportToWord.');
  return capturedBlob;
};

const lastAnchor = (): HTMLAnchorElement => {
  const anchor = clickSpy.mock.instances.at(-1);
  if (!(anchor instanceof HTMLAnchorElement)) throw new Error('Aucun lien cliqué.');
  return anchor;
};

describe('exportToWord', () => {
  it('downloads a Word document built from the HTML content', () => {
    exportToWord('<h1>Mon mémoire</h1><p>contenu</p>', 'Cadrage_Recherche');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(createdUrls).toHaveLength(1);
    expect(lastBlob().type).toBe('application/msword');
    expect(lastBlob().size).toBeGreaterThan(0);

    expect(lastAnchor().download).toBe('Cadrage_Recherche.doc');
    expect(lastAnchor().getAttribute('href')).toBe(createdUrls[0]);
    // The object URL is released once the download has been triggered.
    expect(revokedUrls).toEqual([createdUrls[0]]);
  });

  it('derives the file name from the caller argument', () => {
    exportToWord('<h2>Hypothèses</h2>', 'Outil_enseignants');

    expect(lastAnchor().download).toBe('Outil_enseignants.doc');
  });

  it('keeps the anchor out of the document after the download', () => {
    exportToWord('<p>x</p>', 'fichier');

    expect(lastAnchor().isConnected).toBe(false);
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('does not throw when the content is empty', () => {
    expect(() => exportToWord('', 'vide')).not.toThrow();
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(lastBlob().size).toBeGreaterThan(0);
  });
});

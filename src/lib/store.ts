import type { StoredPainting } from './types';
export type { StoredPainting };

const KEY = (seed: number | string) => `tos:painting:${seed}`;

export function savePainting(p: StoredPainting): void {
  localStorage.setItem(KEY(p.seed), JSON.stringify(p));
}

export function loadPainting(seed: number | string): StoredPainting | null {
  const raw = localStorage.getItem(KEY(seed));
  return raw ? (JSON.parse(raw) as StoredPainting) : null;
}

// --- IndexedDB (audio blobs) ---
const DB_NAME = 'tos';
const STORE = 'audio';

interface StoredAudio {
  type: string;
  buffer: ArrayBuffer;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function blobToBuffer(blob: Blob): Promise<ArrayBuffer> {
  // Blob.arrayBuffer() may not be available in all environments (e.g. jsdom)
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

export async function saveAudio(seed: number | string, blob: Blob): Promise<void> {
  const buffer = await blobToBuffer(blob);
  const record: StoredAudio = { type: blob.type, buffer };
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record, String(seed));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadAudio(seed: number | string): Promise<Blob | null> {
  const db = await openDb();
  try {
    const record = await new Promise<StoredAudio | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(String(seed));
      req.onsuccess = () => resolve((req.result as StoredAudio) ?? null);
      req.onerror = () => reject(req.error);
    });
    if (!record) return null;
    return new Blob([record.buffer], { type: record.type });
  } finally {
    db.close();
  }
}

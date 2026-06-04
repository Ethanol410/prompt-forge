/**
 * Wrapper minimal et typé autour d'IndexedDB. Aucune dépendance externe.
 * Trois object stores : clés de chiffrement, secrets chiffrés, historique.
 * Règle de sécurité : `localStorage` n'est JAMAIS utilisé pour les secrets (uniquement IndexedDB).
 */
const DB_NAME = 'promptforge';
const DB_VERSION = 3;

export const STORE_KEYS = 'crypto-keys';
export const STORE_SECRETS = 'secrets';
export const STORE_HISTORY = 'history';
export const STORE_TEMPLATES = 'templates';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_KEYS)) db.createObjectStore(STORE_KEYS);
      if (!db.objectStoreNames.contains(STORE_SECRETS)) db.createObjectStore(STORE_SECRETS);
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
        db.createObjectStore(STORE_TEMPLATES);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbPut(store: string, value: unknown, key?: IDBValidKey): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  const req = key === undefined ? tx.objectStore(store).put(value) : tx.objectStore(store).put(value, key);
  await promisify(req);
}

export async function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  const tx = db.transaction(store, 'readonly');
  return promisify<T | undefined>(tx.objectStore(store).get(key) as IDBRequest<T | undefined>);
}

export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  await promisify(tx.objectStore(store).delete(key));
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(store, 'readonly');
  return promisify<T[]>(tx.objectStore(store).getAll() as IDBRequest<T[]>);
}

export async function idbClear(store: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  await promisify(tx.objectStore(store).clear());
}

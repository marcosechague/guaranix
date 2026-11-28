/** Private files (payment receipts), behind an interface so tests use memory instead of R2. */
export interface StoredFile {
  body: ReadableStream | ArrayBuffer;
  contentType: string;
}

export interface FileStorage {
  put(key: string, bytes: ArrayBuffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  /** Removing a missing key is not an error. */
  delete(key: string): Promise<void>;
}

export function createR2FileStorage(bucket: R2Bucket): FileStorage {
  return {
    async put(key, bytes, contentType) {
      await bucket.put(key, bytes, { httpMetadata: { contentType } });
    },
    async get(key) {
      const object = await bucket.get(key);
      if (!object) return null;
      return {
        body: object.body,
        contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
      };
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}

export function createMemoryFileStorage(): FileStorage & { keys(): string[] } {
  const files = new Map<string, { bytes: ArrayBuffer; contentType: string }>();
  return {
    async put(key, bytes, contentType) {
      files.set(key, { bytes, contentType });
    },
    async get(key) {
      const file = files.get(key);
      return file ? { body: file.bytes, contentType: file.contentType } : null;
    },
    async delete(key) {
      files.delete(key);
    },
    keys: () => [...files.keys()],
  };
}

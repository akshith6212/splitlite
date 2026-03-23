import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// SecureStore key names support alphanumeric + . _ -
// Cognito keys look like: CognitoIdentityServiceProvider.clientId.email.accessToken
// These are valid as-is (dots allowed) but may exceed 255 chars - sanitize just in case
function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._\-]/g, '_').substring(0, 255);
}

// expo-secure-store enforces a 2048-byte limit per value (especially on Android).
// Cognito JWTs are often 1500-2500 bytes, so we chunk large values to stay under the limit.
const CHUNK_SIZE = 1800;
const CHUNK_KEY_SUFFIX = '__chunk_';

async function setLargeItemAsync(baseKey: string, value: string): Promise<void> {
  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(baseKey, value);
    return;
  }
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    chunks.push(value.slice(i, i + CHUNK_SIZE));
  }
  await Promise.all(
    chunks.map((chunk, i) =>
      SecureStore.setItemAsync(`${baseKey}${CHUNK_KEY_SUFFIX}${i}`, chunk)
    )
  );
  // Store the count so we know how many chunks to read back
  await SecureStore.setItemAsync(`${baseKey}${CHUNK_KEY_SUFFIX}count`, String(chunks.length));
}

async function getLargeItemAsync(baseKey: string): Promise<string | null> {
  const countStr = await SecureStore.getItemAsync(`${baseKey}${CHUNK_KEY_SUFFIX}count`);
  if (countStr === null) {
    // No chunks — try reading as a plain value
    return SecureStore.getItemAsync(baseKey);
  }
  const count = parseInt(countStr, 10);
  const chunks = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      SecureStore.getItemAsync(`${baseKey}${CHUNK_KEY_SUFFIX}${i}`)
    )
  );
  if (chunks.some((c) => c === null)) return null;
  return chunks.join('');
}

async function deleteLargeItemAsync(baseKey: string): Promise<void> {
  const countStr = await SecureStore.getItemAsync(`${baseKey}${CHUNK_KEY_SUFFIX}count`);
  if (countStr !== null) {
    const count = parseInt(countStr, 10);
    await Promise.all([
      ...Array.from({ length: count }, (_, i) =>
        SecureStore.deleteItemAsync(`${baseKey}${CHUNK_KEY_SUFFIX}${i}`)
      ),
      SecureStore.deleteItemAsync(`${baseKey}${CHUNK_KEY_SUFFIX}count`),
    ]);
  } else {
    await SecureStore.deleteItemAsync(baseKey);
  }
}

const KEY_INDEX = 'splitlite_cognito_keys';
const isWeb = Platform.OS === 'web';

// Web storage helpers using localStorage (SecureStore is unavailable on web)
const webStorage = {
  getItem: (key: string): string | null => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

class CognitoSecureStorage {
  private memoryCache: Record<string, string> = {};

  /**
   * Called once on app startup - loads all Cognito tokens from SecureStore (native)
   * or localStorage (web) into the in-memory cache.
   * Must be awaited before CognitoUserPool is used.
   */
  async hydrate(): Promise<void> {
    if (isWeb) {
      // On web, restore from localStorage directly
      try {
        const indexJson = webStorage.getItem(KEY_INDEX);
        if (!indexJson) return;
        const keys: string[] = JSON.parse(indexJson);
        for (const key of keys) {
          const value = webStorage.getItem(key);
          if (value !== null) this.memoryCache[key] = value;
        }
      } catch (e) {
        console.warn('SecureStorage hydrate error (web):', e);
      }
      return;
    }

    try {
      const indexJson = await SecureStore.getItemAsync(KEY_INDEX);
      if (!indexJson) return;
      const keys: string[] = JSON.parse(indexJson);
      const entries = await Promise.all(
        keys.map(async (key) => {
          const value = await getLargeItemAsync(sanitizeKey(key));
          return [key, value] as [string, string | null];
        })
      );
      for (const [key, value] of entries) {
        if (value !== null) this.memoryCache[key] = value;
      }
    } catch (e) {
      console.warn('SecureStorage hydrate error:', e);
    }
  }

  private persistKeyIndex(key: string): void {
    if (isWeb) {
      try {
        const indexJson = webStorage.getItem(KEY_INDEX);
        const keys: string[] = indexJson ? JSON.parse(indexJson) : [];
        if (!keys.includes(key)) {
          keys.push(key);
          webStorage.setItem(KEY_INDEX, JSON.stringify(keys));
        }
      } catch (e) {
        console.warn('SecureStorage persistKeyIndex error (web):', e);
      }
      return;
    }

    SecureStore.getItemAsync(KEY_INDEX)
      .then(async (indexJson) => {
        const keys: string[] = indexJson ? JSON.parse(indexJson) : [];
        if (!keys.includes(key)) {
          keys.push(key);
          await SecureStore.setItemAsync(KEY_INDEX, JSON.stringify(keys));
        }
      })
      .catch((e) => console.warn('SecureStorage persistKeyIndex error:', e));
  }

  // Synchronous - reads from in-memory cache (populated by hydrate())
  getItem(key: string): string | null {
    return this.memoryCache[key] ?? null;
  }

  // Synchronous write to cache, async persist to SecureStore (native) or localStorage (web)
  setItem(key: string, value: string): void {
    this.memoryCache[key] = value;
    if (isWeb) {
      webStorage.setItem(key, value);
      this.persistKeyIndex(key);
    } else {
      setLargeItemAsync(sanitizeKey(key), value)
        .then(() => this.persistKeyIndex(key))
        .catch((e) => console.warn('SecureStorage setItem error:', e));
    }
  }

  removeItem(key: string): void {
    delete this.memoryCache[key];
    if (isWeb) {
      webStorage.removeItem(key);
    } else {
      deleteLargeItemAsync(sanitizeKey(key)).catch((e) =>
        console.warn('SecureStorage removeItem error:', e)
      );
    }
  }

  clear(): void {
    this.memoryCache = {};
    if (isWeb) {
      try {
        const indexJson = webStorage.getItem(KEY_INDEX);
        const keys: string[] = indexJson ? JSON.parse(indexJson) : [];
        for (const k of keys) webStorage.removeItem(k);
        webStorage.removeItem(KEY_INDEX);
      } catch (e) {
        console.warn('SecureStorage clear error (web):', e);
      }
      return;
    }

    SecureStore.getItemAsync(KEY_INDEX)
      .then(async (indexJson) => {
        const storedKeys: string[] = indexJson ? JSON.parse(indexJson) : [];
        await Promise.all([
          ...storedKeys.map((k) => deleteLargeItemAsync(sanitizeKey(k))),
          SecureStore.deleteItemAsync(KEY_INDEX),
        ]);
      })
      .catch((e) => console.warn('SecureStorage clear error:', e));
  }
}

export const cognitoStorage = new CognitoSecureStorage();

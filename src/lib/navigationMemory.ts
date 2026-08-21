import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_PREFIX = 'raidar.navmem.';

function readStorage<T>(key: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (raw === null) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function writeStorage<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota or unavailable — ignore */
  }
}

export function usePersistedState<T>(
  key: string | null | undefined,
  initial: T | (() => T),
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (!key) return typeof initial === 'function' ? (initial as () => T)() : initial;
    const stored = readStorage<T>(key);
    if (stored !== undefined) return stored;
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });

  const keyRef = useRef(key);
  useEffect(() => { keyRef.current = key; }, [key]);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      if (keyRef.current) writeStorage(keyRef.current, resolved);
      return resolved;
    });
  }, []);

  return [value, set];
}

export function clearNavigationMemory(prefix?: string): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k) continue;
      if (k.startsWith(STORAGE_PREFIX)) {
        if (!prefix || k.startsWith(STORAGE_PREFIX + prefix)) keys.push(k);
      }
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

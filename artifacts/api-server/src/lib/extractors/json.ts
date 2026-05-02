export type JsonObject = { [key: string]: unknown };

export function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function getString(v: unknown, key: string): string | undefined {
  if (!isObject(v)) return undefined;
  const x = v[key];
  return typeof x === "string" ? x : undefined;
}

export function getArray(v: unknown, key: string): unknown[] | undefined {
  if (!isObject(v)) return undefined;
  const x = v[key];
  return Array.isArray(x) ? x : undefined;
}

export function getObject(v: unknown, key: string): JsonObject | undefined {
  if (!isObject(v)) return undefined;
  const x = v[key];
  return isObject(x) ? x : undefined;
}

export function getPath(v: unknown, ...keys: string[]): unknown {
  let cur: unknown = v;
  for (const k of keys) {
    if (!isObject(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}

export function walk(
  value: unknown,
  predicate: (v: JsonObject) => unknown,
): unknown {
  const seen = new WeakSet<object>();
  const stack: unknown[] = [value];
  while (stack.length) {
    const v = stack.pop();
    if (v && typeof v === "object") {
      if (seen.has(v as object)) continue;
      seen.add(v as object);
      if (isObject(v)) {
        const hit = predicate(v);
        if (hit) return hit;
        for (const key of Object.keys(v)) stack.push(v[key]);
      } else if (Array.isArray(v)) {
        for (const item of v) stack.push(item);
      }
    }
  }
  return null;
}

export function walkAll(
  value: unknown,
  visitor: (v: JsonObject) => void,
): void {
  const seen = new WeakSet<object>();
  const stack: unknown[] = [value];
  while (stack.length) {
    const v = stack.pop();
    if (v && typeof v === "object") {
      if (seen.has(v as object)) continue;
      seen.add(v as object);
      if (isObject(v)) {
        visitor(v);
        for (const key of Object.keys(v)) stack.push(v[key]);
      } else if (Array.isArray(v)) {
        for (const item of v) stack.push(item);
      }
    }
  }
}

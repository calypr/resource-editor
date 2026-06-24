type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

function stripEmpty(value: JsonLike): JsonLike | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0 ? value : undefined;
  }

  if (Array.isArray(value)) {
    const next = value
      .map((item) => stripEmpty(item))
      .filter((item): item is JsonLike => item !== undefined);

    return next.length > 0 ? next : undefined;
  }

  if (typeof value === 'object') {
    const nextEntries = Object.entries(value)
      .map(([key, item]) => [key, stripEmpty(item)] as const)
      .filter((entry): entry is readonly [string, JsonLike] => entry[1] !== undefined);

    if (nextEntries.length === 0) {
      return undefined;
    }

    return Object.fromEntries(nextEntries) as JsonLike;
  }

  return value;
}

export function stripEmptyFields<T>(value: T): T {
  const stripped = stripEmpty(value as JsonLike);

  if (stripped === undefined) {
    return value;
  }

  return stripped as T;
}
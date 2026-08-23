const TRANSIENT_STATUS_CODES = new Set([429, 500, 503]);

export const isTransientStatus = (status: number): boolean => TRANSIENT_STATUS_CODES.has(status);

export async function retryTransient<T>(
  operation: () => Promise<T>,
  label: string,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const status = error instanceof Error && 'status' in error
        ? Number((error as Error & { status?: number }).status)
        : 0;

      if (!isTransientStatus(status) || attempt === attempts - 1) throw error;
      const delayMs = 500 * (2 ** attempt);
      console.warn(`${label} transient failure (${status}); retrying in ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} failed`);
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

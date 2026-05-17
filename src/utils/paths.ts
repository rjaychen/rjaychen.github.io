/** Returns a fully-qualified internal URL with BASE_URL prefix and trailing slash. */
export function sitePath(...segments: string[]): string {
  const base = import.meta.env.BASE_URL;
  const joined = segments.filter(Boolean).join('/');
  const combined = joined ? `${base}${joined}/` : base;
  // collapse any double slashes that aren't part of "://"
  return combined.replace(/([^:])\/\/+/g, '$1/');
}

/** One URL boundary for local previews and a future approved Pages base path. */
export function route(path: string, base = import.meta.env.BASE_URL): string {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(Number(bytes)) || Number(bytes) <= 0) {
    return "—";
  }
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}
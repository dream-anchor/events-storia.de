/**
 * Pragmatic text chunker: produces chunks of ~800–1500 chars, cut on
 * paragraph / sentence boundaries when possible.
 */
export interface Chunk {
  index: number;
  content: string;
}

const TARGET_MIN = 800;
const TARGET_MAX = 1500;

export function chunkText(text: string): Chunk[] {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!cleaned) return [];
  if (cleaned.length <= TARGET_MAX) {
    return [{ index: 0, content: cleaned }];
  }

  const paragraphs = cleaned.split(/\n\s*\n+/);
  const chunks: Chunk[] = [];
  let buf = "";

  const flush = () => {
    const v = buf.trim();
    if (v.length > 0) chunks.push({ index: chunks.length, content: v });
    buf = "";
  };

  for (const p of paragraphs) {
    const para = p.trim();
    if (!para) continue;
    if (para.length > TARGET_MAX) {
      if (buf) flush();
      // sentence-level split
      const sentences = para.match(/[^.!?\n]+[.!?]+|\S[^.!?\n]*$/g) ?? [para];
      for (const s of sentences) {
        const sent = s.trim();
        if (!sent) continue;
        if ((buf + " " + sent).length > TARGET_MAX) {
          if (buf.length >= TARGET_MIN) flush();
          if (sent.length > TARGET_MAX) {
            // hard-split long sentence
            for (let i = 0; i < sent.length; i += TARGET_MAX) {
              chunks.push({
                index: chunks.length,
                content: sent.slice(i, i + TARGET_MAX).trim(),
              });
            }
            continue;
          }
        }
        buf = buf ? `${buf} ${sent}` : sent;
      }
      if (buf.length >= TARGET_MIN) flush();
      continue;
    }
    if (!buf) {
      buf = para;
    } else if ((buf + "\n\n" + para).length <= TARGET_MAX) {
      buf = `${buf}\n\n${para}`;
    } else {
      flush();
      buf = para;
    }
  }
  if (buf) flush();
  return chunks;
}
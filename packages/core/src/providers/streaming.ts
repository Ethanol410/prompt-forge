/**
 * Utilitaires de parsing de flux. Les adaptateurs reçoivent du port HttpClient un
 * `AsyncIterable<string>` de chunks bruts (dont les frontières ne coïncident PAS avec les lignes) ;
 * ces générateurs réassemblent les lignes complètes.
 */

/** Découpe un flux de chunks en lignes complètes (gère les coupures au milieu d'une ligne). */
export async function* splitLines(chunks: AsyncIterable<string>): AsyncIterable<string> {
  let buffer = '';
  for await (const chunk of chunks) {
    buffer += chunk;
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, '');
      buffer = buffer.slice(newlineIndex + 1);
      yield line;
    }
  }
  const last = buffer.replace(/\r$/, '');
  if (last.length > 0) yield last;
}

/**
 * Extrait les charges utiles `data:` d'un flux SSE (Server-Sent Events).
 * Ignore les lignes vides, les commentaires (`:`) et les champs non-`data`.
 */
export async function* parseSseData(chunks: AsyncIterable<string>): AsyncIterable<string> {
  for await (const line of splitLines(chunks)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice('data:'.length).trimStart();
    if (data.length > 0) yield data;
  }
}

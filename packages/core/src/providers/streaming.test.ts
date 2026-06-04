import { describe, it, expect } from 'vitest';
import { splitLines, parseSseData } from './streaming.js';

async function* fromChunks(chunks: readonly string[]): AsyncIterable<string> {
  for (const c of chunks) yield c;
}

async function collectLines(it: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const line of it) out.push(line);
  return out;
}

describe('splitLines', () => {
  it('réassemble les lignes coupées au milieu d’un chunk', async () => {
    const lines = await collectLines(splitLines(fromChunks(['he', 'llo\nwor', 'ld\n'])));
    expect(lines).toEqual(['hello', 'world']);
  });

  it('gère les fins de ligne CRLF', async () => {
    const lines = await collectLines(splitLines(fromChunks(['a\r\nb\r\n'])));
    expect(lines).toEqual(['a', 'b']);
  });

  it('émet la dernière ligne sans newline final', async () => {
    const lines = await collectLines(splitLines(fromChunks(['x\ny'])));
    expect(lines).toEqual(['x', 'y']);
  });
});

describe('parseSseData', () => {
  it('extrait les charges data: et ignore les commentaires et lignes vides', async () => {
    const data = await collectLines(
      parseSseData(fromChunks([': ping\n', 'data: {"a":1}\n', '\n', 'event: x\n', 'data: [DONE]\n'])),
    );
    expect(data).toEqual(['{"a":1}', '[DONE]']);
  });

  it('réassemble une charge data: répartie sur plusieurs chunks', async () => {
    const data = await collectLines(parseSseData(fromChunks(['data: {"te', 'xt":"hi"}\n'])));
    expect(data).toEqual(['{"text":"hi"}']);
  });
});

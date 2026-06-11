// Source position utilities for action.yml coverage mapping.
// Converts byte offsets from yaml NodeRange to Istanbul line/col positions.

export interface IstanbulLoc {
  line: number;    // 1-based
  column: number;  // 0-based
}

export interface IstanbulRange {
  start: IstanbulLoc;
  end: IstanbulLoc;
}

/** Convert a byte offset within `source` to an Istanbul {line, column} position. */
export function offsetToLoc(source: string, offset: number): IstanbulLoc {
  const safe = Math.max(0, Math.min(offset, source.length));
  let line = 1;
  let column = 0;
  for (let i = 0; i < safe; i++) {
    if (source[i] === '\n') {
      line++;
      column = 0;
    } else {
      column++;
    }
  }
  return { line, column };
}

/** Build an Istanbul range from a NodeRange byte-offset pair. */
export function nodeRangeToIstanbul(
  source: string,
  start: number,
  end: number,
): IstanbulRange {
  return {
    start: offsetToLoc(source, start),
    end: offsetToLoc(source, end),
  };
}

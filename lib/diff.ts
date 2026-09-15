export type DiffLine = {
  kind: "context" | "added" | "removed";
  text: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  hasNewline: boolean;
};

// Bound the comparison matrix for large raw policies.
const MAX_DIFF_CELLS = 1_000_000;

export function diffLines(before: string, after: string): DiffLine[] {
  const oldLines = before.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const newLines = after.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const result: DiffLine[] = [];
  let oldLineNumber = 1;
  let newLineNumber = 1;
  const append = (kind: DiffLine["kind"], token: string) => {
    result.push({
      kind,
      text: token.replace(/\r?\n$/, ""),
      oldLineNumber: kind === "added" ? null : oldLineNumber++,
      newLineNumber: kind === "removed" ? null : newLineNumber++,
      hasNewline: token.endsWith("\n"),
    });
  };

  let start = 0;
  while (
    start < oldLines.length &&
    start < newLines.length &&
    oldLines[start] === newLines[start]
  ) {
    append("context", oldLines[start++]);
  }
  let oldEnd = oldLines.length;
  let newEnd = newLines.length;
  while (
    oldEnd > start &&
    newEnd > start &&
    oldLines[oldEnd - 1] === newLines[newEnd - 1]
  ) {
    oldEnd--;
    newEnd--;
  }

  const oldCount = oldEnd - start;
  const newCount = newEnd - start;
  const width = newCount + 1;
  const cells = (oldCount + 1) * width;
  if (oldCount === 0 || newCount === 0 || cells > MAX_DIFF_CELLS) {
    for (let i = start; i < oldEnd; i++) append("removed", oldLines[i]);
    for (let j = start; j < newEnd; j++) append("added", newLines[j]);
  } else {
    const lengths = new Uint32Array(cells);
    for (let i = oldCount - 1; i >= 0; i--) {
      for (let j = newCount - 1; j >= 0; j--) {
        lengths[i * width + j] =
          oldLines[start + i] === newLines[start + j]
            ? lengths[(i + 1) * width + j + 1] + 1
            : Math.max(
                lengths[(i + 1) * width + j],
                lengths[i * width + j + 1],
              );
      }
    }
    let i = 0;
    let j = 0;
    const removed: string[] = [];
    const added: string[] = [];
    const flush = () => {
      for (const token of removed) append("removed", token);
      for (const token of added) append("added", token);
      removed.length = 0;
      added.length = 0;
    };
    while (i < oldCount && j < newCount) {
      if (oldLines[start + i] === newLines[start + j]) {
        flush();
        append("context", oldLines[start + i]);
        i++;
        j++;
      } else if (lengths[(i + 1) * width + j] >= lengths[i * width + j + 1]) {
        removed.push(oldLines[start + i++]);
      } else {
        added.push(newLines[start + j++]);
      }
    }
    while (i < oldCount) removed.push(oldLines[start + i++]);
    while (j < newCount) added.push(newLines[start + j++]);
    flush();
  }

  for (let i = oldEnd; i < oldLines.length; i++) {
    append("context", oldLines[i]);
  }
  return result;
}

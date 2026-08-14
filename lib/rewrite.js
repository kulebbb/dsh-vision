// rewrite.js — pure helpers that turn image content blocks into text.
// No I/O; pure functions only.

/**
 * Collect every image attachment reference in one content array, in traversal
 * order, descending into tool-result content.
 * @param {Array} content - message content blocks.
 * @returns {Array} attachment refs in order.
 */
export function collectImages(content) {
  const refs = [];
  const walk = (blocks) => {
    for (const block of blocks) {
      if (block?.type === "image") refs.push(block.attachment);
      else if (block?.type === "tool-result" && Array.isArray(block.content)) walk(block.content);
    }
  };
  walk(content);
  return refs;
}

/**
 * Map one content array, replacing every image block with a text block whose
 * text is produced by `onImage(attachment)` (called in traversal order).
 * Returns a NEW array; the input is never mutated.
 * @param {Array} content - message content blocks.
 * @param {(attachment: unknown) => string} onImage
 * @returns {Array} a new content array with image blocks replaced.
 */
export function mapImages(content, onImage) {
  return content.map((block) => {
    if (block?.type === "image") {
      return { type: "text", text: onImage(block.attachment) };
    }
    if (block?.type === "tool-result" && Array.isArray(block.content)) {
      return { ...block, content: mapImages(block.content, onImage) };
    }
    return block;
  });
}

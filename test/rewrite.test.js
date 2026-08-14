import { test } from "node:test";
import assert from "node:assert/strict";
import { collectImages, mapImages } from "../lib/rewrite.js";

const ref = (id) => ({ attachmentId: id, mediaType: "image/png", bytes: 1, width: 1, height: 1 });

test("collectImages: top-level, nested tool-result, order, none", () => {
  const content = [
    { type: "text", text: "hi" },
    { type: "image", attachment: ref("a") },
    { type: "tool-result", toolCallId: "c1", content: [
      { type: "text", text: "out" },
      { type: "image", attachment: ref("b") }
    ] },
    { type: "image", attachment: ref("c") }
  ];
  assert.deepEqual(collectImages(content).map((r) => r.attachmentId), ["a", "b", "c"]);
  assert.deepEqual(collectImages([{ type: "text", text: "plain" }]), []);
});

test("mapImages: replaces images in order and keeps other blocks intact", () => {
  const content = [
    { type: "image", attachment: ref("a") },
    { type: "text", text: "keep" },
    { type: "tool-result", toolCallId: "c1", content: [
      { type: "image", attachment: ref("b") }
    ] }
  ];
  const out = mapImages(content, (att) => `[desc ${att.attachmentId}]`);
  assert.deepEqual(out, [
    { type: "text", text: "[desc a]" },
    { type: "text", text: "keep" },
    { type: "tool-result", toolCallId: "c1", content: [
      { type: "text", text: "[desc b]" }
    ] }
  ]);
});

test("mapImages: does not mutate the input", () => {
  const content = [{ type: "image", attachment: ref("a") }];
  const frozen = JSON.parse(JSON.stringify(content));
  mapImages(content, () => "x");
  assert.deepEqual(content, frozen);
});

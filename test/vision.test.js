import { test } from "node:test";
import assert from "node:assert/strict";
import { describeImage } from "../lib/vision.js";

const bytes = new Uint8Array([1, 2, 3, 4]);
const jsonResponse = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("describeImage: builds data URL, auth header, and returns content", async () => {
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return jsonResponse(200, { choices: [{ message: { content: "a red car" } }] });
  };
  const deps = {
    baseUrl: "https://vision.example/v1",
    model: "qwen-vl",
    resolveApiKey: async () => "sk-test",
    timeoutMs: 5000
  };
  const out = await describeImage(bytes, "image/png", "what color?", undefined, deps);
  assert.equal(out, "a red car");
  assert.equal(captured.url, "https://vision.example/v1/chat/completions");
  assert.equal(captured.init.headers.authorization, "Bearer sk-test");
  const body = JSON.parse(captured.init.body);
  assert.equal(body.model, "qwen-vl");
  assert.equal(body.messages[0].content[1].image_url.url, "data:image/png;base64,AQIDBA==");
  assert.match(body.messages[0].content[0].text, /Question: what color\?/);
});

test("describeImage: non-2xx throws VISION_HTTP_*", async () => {
  globalThis.fetch = async () => jsonResponse(401, {});
  const deps = { baseUrl: "https://v", model: "m", resolveApiKey: async () => "k" };
  await assert.rejects(
    describeImage(bytes, "image/png", undefined, undefined, deps),
    (e) => e.code === "VISION_HTTP_401"
  );
});

test("describeImage: empty content throws VISION_EMPTY", async () => {
  globalThis.fetch = async () => jsonResponse(200, { choices: [{ message: { content: "" } }] });
  const deps = { baseUrl: "https://v", model: "m", resolveApiKey: async () => "k" };
  await assert.rejects(
    describeImage(bytes, "image/png", undefined, undefined, deps),
    (e) => e.code === "VISION_EMPTY"
  );
});

test("describeImage: timeout throws VISION_TIMEOUT", async () => {
  // A ref'd timer keeps the event loop alive past the unref'd AbortSignal.timeout,
  // then the mock rejects so the catch classifies it as a timeout.
  globalThis.fetch = async () => new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error("slow")), 40);
  });
  const deps = { baseUrl: "https://v", model: "m", resolveApiKey: async () => "k", timeoutMs: 10 };
  await assert.rejects(
    describeImage(bytes, "image/png", undefined, undefined, deps),
    (e) => e.code === "VISION_TIMEOUT"
  );
});

test("describeImage: caller abort throws VISION_ABORTED", async () => {
  globalThis.fetch = async () => { throw new Error("aborted"); };
  const deps = { baseUrl: "https://v", model: "m", resolveApiKey: async () => "k", timeoutMs: 5000 };
  const signal = AbortSignal.abort();
  await assert.rejects(
    describeImage(bytes, "image/png", undefined, signal, deps),
    (e) => e.code === "VISION_ABORTED"
  );
});

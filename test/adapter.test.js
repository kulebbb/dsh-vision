import { test } from "node:test";
import assert from "node:assert/strict";
import { DeepSeekAdapter } from "@deepseek-ai/dsh-llm-deepseek";
import { LlmError } from "@deepseek-ai/dsh-llm";
import { VisionDeepSeekAdapter } from "../lib/adapter.js";

function makeAdapter(vision = {}) {
  const config = {
    options: () => ({
      baseURL: "https://api.deepseek.com",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      defaults: {},
      maxTokens: 256000,
      defaultContextWindow: 1000000,
      models: [{ id: "deepseek-v4-pro", name: "Pro" }],
      streamIdleTimeoutMs: 300000,
      retryPolicy: {}
    }),
    resolveApiKey: async () => "sk-deepseek",
    resolveUserId: () => "u1"
  };
  return new VisionDeepSeekAdapter(config, vision);
}

const imageRef = { attachmentId: "a1", mediaType: "image/png", bytes: 1, width: 1, height: 1 };

test("resolveModel declares image input", async () => {
  const info = await makeAdapter().resolveModel("deepseek-vision", "deepseek-v4-pro");
  assert.deepEqual(info.inputModalities, ["text", "image"]);
  assert.equal(info.id, "deepseek-v4-pro");
});

test("listModels declares image input", async () => {
  const models = await makeAdapter().listModels("deepseek-vision");
  assert.deepEqual(models[0].inputModalities, ["text", "image"]);
});

test("stream without images delegates the same options object", async () => {
  let delegated;
  DeepSeekAdapter.prototype.stream = async function* (options) { delegated = options; };
  const adapter = makeAdapter();
  const options = { messages: [{ content: [{ type: "text", text: "hello" }] }] };
  for await (const _ of adapter.stream(options)) { /* empty */ }
  assert.strictEqual(delegated, options);
});

test("stream with images rewrites messages before delegating", async () => {
  let delegated;
  DeepSeekAdapter.prototype.stream = async function* (options) { delegated = options; };
  const vision = {
    maxImages: 5,
    readImage: async (ref) => ({ ref, data: new Uint8Array([1]) }),
    resolveApiKey: async () => "sk-vision",
    baseUrl: "https://vision.example/v1",
    model: "qwen-vl",
    timeoutMs: 5000
  };
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "a red car" } }] }) });
  const adapter = makeAdapter(vision);
  const options = { messages: [
    { content: [{ type: "text", text: "see:" }, { type: "image", attachment: imageRef }] }
  ] };
  for await (const _ of adapter.stream(options)) { /* empty */ }
  assert.notStrictEqual(delegated, options);
  assert.deepEqual(delegated.messages[0].content, [
    { type: "text", text: "see:" },
    { type: "text", text: "[Image 1] a red car" }
  ]);
  assert.equal(options.messages[0].content[1].type, "image");
});

test("stream throws VISION_UNAVAILABLE when vision key is missing", async () => {
  const vision = {
    maxImages: 5,
    readImage: async (ref) => ({ ref, data: new Uint8Array([1]) }),
    resolveApiKey: async () => { throw new LlmError("no vision key", "VISION_UNAVAILABLE"); },
    baseUrl: "https://vision.example/v1",
    model: "qwen-vl",
    timeoutMs: 5000
  };
  const adapter = makeAdapter(vision);
  const options = { messages: [{ content: [{ type: "image", attachment: imageRef }] }] };
  await assert.rejects(
    async () => { for await (const _ of adapter.stream(options)) { /* empty */ } },
    (e) => e.code === "VISION_UNAVAILABLE"
  );
});

test("stream truncates images beyond maxImages", async () => {
  let delegated;
  DeepSeekAdapter.prototype.stream = async function* (options) { delegated = options; };
  const vision = {
    maxImages: 2,
    readImage: async (ref) => ({ ref, data: new Uint8Array([1]) }),
    resolveApiKey: async () => "sk-vision",
    baseUrl: "https://vision.example/v1",
    model: "qwen-vl",
    timeoutMs: 5000
  };
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "desc" } }] }) });
  const adapter = makeAdapter(vision);
  const ref = (id) => ({ attachmentId: id, mediaType: "image/png", bytes: 1, width: 1, height: 1 });
  const options = { messages: [{ content: [
    { type: "image", attachment: ref("a") },
    { type: "image", attachment: ref("b") },
    { type: "image", attachment: ref("c") }
  ] }] };
  for await (const _ of adapter.stream(options)) { /* empty */ }
  assert.deepEqual(delegated.messages[0].content, [
    { type: "text", text: "[Image 1] desc" },
    { type: "text", text: "[Image 2] desc" },
    { type: "text", text: "[Image 3] <图片已截断>" }
  ]);
});

test("stream keeps per-image describe failure as placeholder", async () => {
  let delegated;
  DeepSeekAdapter.prototype.stream = async function* (options) { delegated = options; };
  const vision = {
    maxImages: 5,
    readImage: async (ref) => ({ ref, data: new Uint8Array([1]) }),
    resolveApiKey: async () => "sk-vision",
    baseUrl: "https://vision.example/v1",
    model: "qwen-vl",
    timeoutMs: 5000
  };
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  const adapter = makeAdapter(vision);
  const options = { messages: [{ content: [{ type: "image", attachment: imageRef }] }] };
  for await (const _ of adapter.stream(options)) { /* empty */ }
  assert.equal(delegated.messages[0].content[0].text, "[Image 1] <描述失败: vision API error (HTTP 500)>");
});

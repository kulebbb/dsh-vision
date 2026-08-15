import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { getOrCreateAnonymousUserId } from "@deepseek-ai/dsh-anonymous-user-id";
import { LlmError, assertUsableApiKey } from "@deepseek-ai/dsh-llm";
import { resolveAdapterOptions } from "@deepseek-ai/dsh-llm-deepseek";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import { VisionDeepSeekAdapter } from "./adapter.js";
import { applyDescribeImageTool } from "./tool.js";

export const inject = ["llm", "attachments", "credentials", "tools"];

const NS = settingsNamespace("dsh-vision");
const PROVIDER = "deepseek-vision";
const DEFAULT_VISION_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_VISION_MODEL = "gpt-4o-mini";
const DEFAULT_VISION_API_KEY_ENV = "VISION_API_KEY";

const catalogModel = z.object({
  id: z.string().required(),
  name: z.string(),
  description: z.string(),
  contextWindow: z.number().step(1).min(1),
  maxTokens: z.number().step(1).min(1)
});

export const Config = z.object({
  deepseek: z.object({
    baseURL: z.string(),
    apiKeyEnv: z.string().role("credential-ref").default("DEEPSEEK_API_KEY"),
    models: z.array(catalogModel)
  }),
  vision: z.object({
    baseUrl: z.string().default("https://api.openai.com/v1"),
    model: z.string().default("gpt-4o-mini"),
    apiKeyEnv: z.string().role("credential-ref").default("VISION_API_KEY"),
    timeoutMs: z.number().step(1).min(1000).max(600000).default(60000),
    maxImages: z.number().step(1).min(1).max(20).default(5)
  })
});

/**
 * Register the vision-wrapping DeepSeek adapter under the `deepseek-vision`
 * provider route, plus the `describe_image` tool. The plugin's composition
 * entry is layered under the `dsh-vision` user-settings section, so a changed
 * endpoint, model, key, timeout, or image cap reaches the very next request.
 * @param {import("@deepseek-ai/cordis").Context} ctx
 * @param {object} [config] - { deepseek?: {...}, vision?: {...} }
 */
export function apply(ctx, config = {}) {
  let current = () => config;
  let lastRaw;
  let lastGood;

  // Memoized thunk keyed on the current settings source: re-resolve the
  // DeepSeek connection facts when the settings section changes, keeping the
  // last good configuration after an invalid section (mirrors dsh-llm-deepseek).
  const connection = () => {
    const raw = current();
    if (raw === lastRaw && lastGood !== undefined) return lastGood;
    try {
      const next = resolveAdapterOptions(raw.deepseek ?? {}, launchEnvironmentOf(ctx));
      lastRaw = raw;
      lastGood = next;
      return next;
    } catch (error) {
      if (lastGood === undefined) throw error;
      lastRaw = raw;
      ctx.logger.error("dsh-vision: keeping the last good configuration after an invalid settings section");
      ctx.logger.error(error);
      return lastGood;
    }
  };
  connection(); // validate once at load

  const resolveDeepSeekApiKey = async (conn) => {
    const hit = await ctx.credentials.resolve(conn.apiKeyEnv);
    if (hit !== undefined) return assertUsableApiKey(hit.value, "dsh-vision", conn.apiKeyEnv);
    throw new LlmError(
      `dsh-vision: no DeepSeek API key for provider route "${PROVIDER}"; store ${String(conn.apiKeyEnv)} through the credentials service or export it in the environment`,
      "MISSING_CREDENTIAL"
    );
  };

  const visionDeps = {
    get baseUrl() {
      const vision = current().vision ?? {};
      return (vision.baseUrl ?? DEFAULT_VISION_BASE_URL).replace(/\/+$/, "");
    },
    get model() {
      return (current().vision ?? {}).model ?? DEFAULT_VISION_MODEL;
    },
    get timeoutMs() {
      return (current().vision ?? {}).timeoutMs ?? 60000;
    },
    get maxImages() {
      return (current().vision ?? {}).maxImages ?? 5;
    },
    readImage: (ref, signal) => ctx.attachments.readImage(ref, signal),
    resolveApiKey: async () => {
      const vision = current().vision ?? {};
      const visionApiKeyRef = credentialRef(vision.apiKeyEnv || DEFAULT_VISION_API_KEY_ENV);
      const hit = await ctx.credentials.resolve(visionApiKeyRef);
      if (hit !== undefined) return assertUsableApiKey(hit.value, "dsh-vision", visionApiKeyRef);
      throw new LlmError(
        `dsh-vision: no vision API key; store ${String(visionApiKeyRef)} through the credentials service or export it in the environment`,
        "VISION_UNAVAILABLE"
      );
    },
    logger: ctx.logger
  };

  const adapter = new VisionDeepSeekAdapter({
    options: connection,
    resolveApiKey: resolveDeepSeekApiKey,
    resolveUserId: () => getOrCreateAnonymousUserId()
  }, visionDeps);

  ctx.llm.registerAdapter([PROVIDER], adapter);
  applyDescribeImageTool(ctx, visionDeps);

  installSettingsSection(ctx, NS, Config, config, {
    setSource: (source) => {
      current = source;
    },
    onChange: () => {}
  });
}

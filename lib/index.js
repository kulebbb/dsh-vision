import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { getOrCreateAnonymousUserId } from "@deepseek-ai/dsh-anonymous-user-id";
import { LlmError, assertUsableApiKey } from "@deepseek-ai/dsh-llm";
import { resolveAdapterOptions } from "@deepseek-ai/dsh-llm-deepseek";
import { VisionDeepSeekAdapter } from "./adapter.js";
import { applyDescribeImageTool } from "./tool.js";

export const inject = ["llm", "attachments", "credentials", "tools"];

const PROVIDER = "deepseek-vision";
const DEFAULT_VISION_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_VISION_MODEL = "gpt-4o-mini";
const DEFAULT_VISION_API_KEY_ENV = "VISION_API_KEY";

/**
 * Register the vision-wrapping DeepSeek adapter under the `deepseek-vision`
 * provider route, plus the `describe_image` tool.
 * @param {import("@deepseek-ai/cordis").Context} ctx
 * @param {object} [config] - { deepseek?: {...}, vision?: {...} }
 */
export function apply(ctx, config = {}) {
  const deepseek = config.deepseek ?? {};
  const vision = config.vision ?? {};

  const connection = () => resolveAdapterOptions(deepseek, undefined);
  connection(); // validate eagerly; throws at load on invalid deepseek config

  const resolveDeepSeekApiKey = async (conn) => {
    const hit = await ctx.credentials.resolve(conn.apiKeyEnv);
    if (hit !== undefined) return assertUsableApiKey(hit.value, "dsh-vision", conn.apiKeyEnv);
    throw new LlmError(
      `dsh-vision: no DeepSeek API key for provider route "${PROVIDER}"; store ${String(conn.apiKeyEnv)} through the credentials service or export it in the environment`,
      "MISSING_CREDENTIAL"
    );
  };

  const visionApiKeyRef = credentialRef(vision.apiKeyEnv ?? DEFAULT_VISION_API_KEY_ENV);
  const visionDeps = {
    baseUrl: (vision.baseUrl ?? DEFAULT_VISION_BASE_URL).replace(/\/+$/, ""),
    model: vision.model ?? DEFAULT_VISION_MODEL,
    timeoutMs: vision.timeoutMs ?? 60000,
    maxImages: vision.maxImages ?? 5,
    readImage: (ref, signal) => ctx.attachments.readImage(ref, signal),
    resolveApiKey: async () => {
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
}

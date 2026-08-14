import { DeepSeekAdapter } from "@deepseek-ai/dsh-llm-deepseek";
import { collectImages, mapImages } from "./rewrite.js";
import { describeImage } from "./vision.js";

/**
 * A DeepSeek adapter that declares image input and converts any image content
 * block into a text description before delegating to the text-only DeepSeek
 * wire adapter. Faithful port of deepseek-vision's vision middleware.
 */
export class VisionDeepSeekAdapter extends DeepSeekAdapter {
  /** @param {import("@deepseek-ai/dsh-llm-deepseek").DeepSeekAdapterOptions} config */
  /** @param {object} vision - { baseUrl, model, resolveApiKey, timeoutMs, maxImages, readImage, logger } */
  constructor(config, vision) {
    super(config);
    this.vision = vision;
  }

  async resolveModel(provider, model, signal) {
    const base = await super.resolveModel(provider, model, signal);
    return { ...base, inputModalities: ["text", "image"] };
  }

  async listModels(provider) {
    const base = await super.listModels(provider);
    return base.map((m) => ({ ...m, inputModalities: ["text", "image"] }));
  }

  async *stream(options) {
    const images = options.messages.flatMap((message) => collectImages(message.content));
    if (images.length === 0) {
      yield* super.stream(options);
      return;
    }
    const maxImages = this.vision.maxImages ?? 5;
    const visible = images.slice(0, maxImages);
    const descriptions = await Promise.all(visible.map((ref) => this.describeRef(ref, options.signal)));
    let index = 0;
    const newMessages = options.messages.map((message) => ({
      ...message,
      content: mapImages(message.content, () => {
        index += 1;
        if (index > descriptions.length) return `[Image ${index}] <图片已截断>`;
        return `[Image ${index}] ${descriptions[index - 1]}`;
      })
    }));
    yield* super.stream({ ...options, messages: newMessages });
  }

  async describeRef(ref, signal) {
    try {
      const stored = await this.vision.readImage(ref, signal);
      return await describeImage(stored.data, ref.mediaType, undefined, signal, this.vision);
    } catch (error) {
      this.vision.logger?.warn(`[dsh-vision] failed to describe image ${String(ref?.attachmentId ?? "")}:`, error);
      return `<描述失败: ${String(error?.message ?? error)}>`;
    }
  }
}

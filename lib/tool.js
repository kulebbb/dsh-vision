import { readFile } from "node:fs/promises";
import { extname, isAbsolute } from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { LlmError } from "@deepseek-ai/dsh-llm";
import { describeImage } from "./vision.js";

const EXT_MEDIA = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

function mediaTypeForPath(path) {
  return EXT_MEDIA[extname(path).toLowerCase()];
}

/**
 * Register the `describe_image` tool: describe a local image file or an
 * http(s) image URL through the vision backend, returning text.
 * @param {import("@deepseek-ai/cordis").Context} ctx
 * @param {object} vision - the shared vision deps (see index.js).
 */
export function applyDescribeImageTool(ctx, vision) {
  ctx.tools.register(defineTool({
    name: "describe_image",
    description:
      "Describe an image (local absolute path or http(s) URL) by sending it to a vision model and returning a text description. Use this to 'see' screenshots, diagrams, photos, or any image the conversation references.",
    parameters: {
      image: { type: "string", required: true, description: "Local absolute file path, or an http(s) URL." },
      question: { type: "string", description: "Optional focused question about the image." }
    },
    output: {
      schema: { type: "string" },
      render: (_args, text) => [{ type: "text", text }]
    },
    async execute(args, exec) {
      let bytes;
      let mediaType;
      if (/^https?:\/\//i.test(args.image)) {
        const timeoutSignal = AbortSignal.timeout(vision.timeoutMs ?? 60000);
        const response = await fetch(args.image, { signal: AbortSignal.any([exec.signal, timeoutSignal]) });
        if (!response.ok) throw new LlmError(`image URL returned HTTP ${response.status}`, "IMAGE_FETCH_HTTP");
        const declared = response.headers.get("content-type")?.split(";")[0].trim();
        mediaType = declared?.startsWith("image/") ? declared : undefined;
        bytes = new Uint8Array(await response.arrayBuffer());
      } else {
        if (!isAbsolute(args.image)) throw new LlmError("image must be an absolute local path or an http(s) URL", "INVALID_ARGS");
        bytes = await readFile(args.image);
        mediaType = mediaTypeForPath(args.image);
      }
      return describeImage(bytes, mediaType || "image/png", args.question, exec.signal, vision);
    }
  }));
}

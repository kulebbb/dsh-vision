import { LlmError } from "@deepseek-ai/dsh-llm";

const SYSTEM_PROMPT =
  "Describe the image in detail, focusing on content useful to a text-only assistant. " +
  "Report text, layout, objects, colors, and any numbers or labels you can read.";

/**
 * Describe one image through an OpenAI-compatible chat-completions vision
 * endpoint. Returns the model's text content.
 * @param {Uint8Array} bytes - encoded image bytes.
 * @param {string} mediaType - e.g. "image/png".
 * @param {string | undefined} question - optional focused question.
 * @param {AbortSignal | undefined} signal - caller cancellation.
 * @param {object} deps - { baseUrl, model, resolveApiKey, timeoutMs }.
 * @returns {Promise<string>}
 */
export async function describeImage(bytes, mediaType, question, signal, deps) {
  const b64 = Buffer.from(bytes).toString("base64");
  const dataUrl = `data:${mediaType};base64,${b64}`;
  const text = question && question.trim().length > 0
    ? `${SYSTEM_PROMPT}\n\nQuestion: ${question.trim()}`
    : SYSTEM_PROMPT;
  const apiKey = await deps.resolveApiKey();
  const timeoutMs = deps.timeoutMs ?? 60000;
  const controller = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, controller]) : controller;

  let response;
  try {
    response = await fetch(`${deps.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: deps.model,
        messages: [{ role: "user", content: [
          { type: "text", text },
          { type: "image_url", image_url: { url: dataUrl } }
        ] }],
        max_tokens: 1024
      }),
      signal: combined
    });
  } catch (error) {
    if (controller.aborted && !signal?.aborted) {
      throw new LlmError("vision request timed out", "VISION_TIMEOUT", { cause: error });
    }
    if (signal?.aborted) {
      throw new LlmError("vision request aborted", "VISION_ABORTED", { cause: error });
    }
    throw new LlmError(`vision request failed: ${String(error?.message ?? error)}`, "VISION_TRANSPORT", { cause: error });
  }
  if (!response.ok) {
    throw new LlmError(`vision API error (HTTP ${response.status})`, `VISION_HTTP_${response.status}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new LlmError("vision API returned no content", "VISION_EMPTY");
  }
  return content;
}

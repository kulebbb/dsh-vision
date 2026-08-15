# @deepseek-ai/dsh-vision

给没有视觉能力的 DeepSeek 模型补齐视觉能力：把发给模型的图片块调一个 OpenAI 兼容视觉模型转成文字描述，再交给纯文本模型。参考 [ErlichLiu/deepseek-vision](https://github.com/ErlichLiu/deepseek-vision) 的核心机制，以 DSH 原生**适配器插件**实现。

## 结构

| 文件 | 职责 |
|---|---|
| `lib/index.js` | `apply(ctx, config)`：注册 `deepseek-vision` 适配器 + `describe_image` 工具 |
| `lib/adapter.js` | `VisionDeepSeekAdapter extends DeepSeekAdapter`：声明 image 输入，`stream()` 里图片→文字 |
| `lib/vision.js` | `describeImage()`：OpenAI 兼容 chat/completions 视觉调用 |
| `lib/rewrite.js` | `collectImages` / `mapImages` 纯变换 |
| `lib/tool.js` | `describe_image` 工具定义 |
| `lib/client.js` | Browser half：Settings 里的「视觉/Vision」配置页 |

## 安装（web profile）

```sh
cd ~/.dsh/profiles/web
pnpm add link:/Users/zhaoliang/Documents/coding/deepseek-harness/plugins/dsh-vision
# 在 cordis.patch.yml 的 insert 列表追加（config 可按需覆盖）：
#   - id: dsh-vision
#     name: '@deepseek-ai/dsh-vision'
#     config:
#       deepseek:
#         apiKeyEnv: DEEPSEEK_API_KEY
#       vision:
#         baseUrl: https://dashscope.aliyuncs.com/compatible-mode/v1
#         model: qwen-vl-max
#         apiKeyEnv: VISION_API_KEY
# 然后重启 dsh web。
```

## 配置

| 字段 | 默认值 | 说明 |
|---|---|---|
| `deepseek.baseURL` | `https://api.deepseek.com` | DeepSeek 端点 |
| `deepseek.apiKeyEnv` | `DEEPSEEK_API_KEY` | DeepSeek 密钥 credential ref |
| `deepseek.models` | `deepseek-v4-pro` / `deepseek-v4-flash` | 暴露的模型目录 |
| `vision.baseUrl` | `https://api.openai.com/v1` | 视觉端点（OpenAI 兼容） |
| `vision.model` | `gpt-4o-mini` | 视觉模型名 |
| `vision.apiKeyEnv` | `VISION_API_KEY` | 视觉密钥 credential ref |
| `vision.timeoutMs` | `60000` | 单次视觉调用超时 |
| `vision.maxImages` | `5` | 单请求最多描述的图片数 |

密钥经 `ctx.credentials` 按 ref 每次解析（存环境变量或 `$DSH_HOME/.credentials.yaml`），**不进配置**。

**Settings UI**：重启后，打开 DSH 的 Settings 会出现「视觉 / Vision」页，可在其中直接编辑 `vision.baseUrl` / `vision.model` / `vision.apiKeyEnv` / `vision.timeoutMs` / `vision.maxImages` 以及 API Key（key 作为凭据写入，不进设置文件）。端点/模型等字段保存后即时生效（无需重启），API Key 也即时生效。

## 使用

- 在模型选择器选 **`deepseek-vision`** provider（模型名不变）。之后在输入框粘贴图片，模型收到的会是 `[Image N] <描述>` 文本，不再报「select an image-capable model」。
- 让模型主动「看」工作区图片：`describe_image` 工具，参数 `image`（绝对路径或 URL）+ 可选 `question`。

## 测试

```sh
cd plugins/dsh-vision && node --test test/
```

# @kulebbb/dsh-vision

给没有视觉能力的 DeepSeek 模型补齐视觉能力：把发给模型的图片块调一个 OpenAI 兼容视觉模型转成文字描述，再交给纯文本模型。参考 [ErlichLiu/deepseek-vision](https://github.com/ErlichLiu/deepseek-vision) 的核心机制，以 DSH 原生**适配器插件**实现。

仓库：<https://github.com/kulebbb/dsh-vision> · npm：<https://www.npmjs.com/package/@kulebbb/dsh-vision>

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
pnpm add @kulebbb/dsh-vision
```

在 `cordis.patch.yml` 的 insert 列表追加（config 可按需覆盖）：

```yaml
- insert:
    - id: dsh-vision
      name: '@kulebbb/dsh-vision'
      config:
        deepseek:
          apiKeyEnv: DEEPSEEK_API_KEY
        vision:
          baseUrl: https://dashscope.aliyuncs.com/compatible-mode/v1
          model: qwen-vl-max
          apiKeyEnv: VISION_API_KEY
```

然后重启 `dsh web`。

也可以直接从 GitHub 安装（不经过 npm registry）：`pnpm add github:kulebbb/dsh-vision`。

> 依赖的 `@deepseek-ai/*` 运行库由 DSH 安装自带（peer 依赖已标为 optional，安装时无需也不可单独拉取），本插件无需额外安装任何依赖。

## 🤖 Agent 一键安装

把下面**任一段**提示词（中文或英文）复制发给你的 AI 助手（DeepSeek / Claude / Cursor 等），它会自动完成安装。如需同时安装 [dsh-git-tree](https://github.com/kulebbb/dsh-git-tree)，把两个插件的提示词一起发给助手，它会依次完成。

**中文版**

```text
你是一个安装助手。请帮我把 DSH（DeepSeek Harness）插件 @kulebbb/dsh-vision 安装到我的 web profile 中，并完成配置。

【背景】
@kulebbb/dsh-vision 是 DSH 适配器插件，为纯文本 DeepSeek 模型补齐视觉能力：把发给模型的图片转成文字描述，再交给文本模型。它依赖的 @deepseek-ai/* 运行库由 DSH 安装自带，无需（也无法）单独安装。

【前置检查】
1. 运行 dsh --version 确认 DSH 已安装；若命令不存在，告诉我"未检测到 dsh，需要先安装 DSH"并停止。
2. 确认目录 ~/.dsh/profiles/web（或 $DSH_HOME/profiles/web）存在；若不存在，先运行 dsh web 完成首次初始化。

【安装步骤】
1. cd ~/.dsh/profiles/web
2. 运行：pnpm add @kulebbb/dsh-vision
3. 打开（或创建）cordis.patch.yml，在顶层 insert 列表【末尾追加】以下条目。注意：片段中的 - insert: 是文件的顶层列表项，写入时必须顶格（去掉每行前导空格），片段内部缩进保持不变；不要覆盖或改动其他已有条目；若已存在 id 为 dsh-vision 的条目，只更新它的 name 和 config：
   - insert:
       - id: dsh-vision
         name: '@kulebbb/dsh-vision'
         config:
           deepseek:
             apiKeyEnv: DEEPSEEK_API_KEY
           vision:
             baseUrl: https://dashscope.aliyuncs.com/compatible-mode/v1
             model: qwen-vl-max
             apiKeyEnv: VISION_API_KEY
   说明：apiKeyEnv 是凭据引用名。请提醒我在环境变量或 $DSH_HOME/.credentials.yaml 中准备好 DEEPSEEK_API_KEY 和 VISION_API_KEY；不要把真实密钥写进 yaml 文件。
4. 重启 dsh web（若正在运行）。

【验证】
- 运行 dsh --profile web --dump-config，确认输出包含 id: dsh-vision 与 name: '@kulebbb/dsh-vision'。
- 重启后：Settings 出现「视觉 / Vision」配置页；模型选择器出现 deepseek-vision provider；粘贴图片不再报「select an image-capable model」。

【异常处理】
- 任何命令报错，把完整错误信息原样转达给我，不要擅自修改配置或改用其他方案。
- 若 pnpm 报 peer 依赖相关错误（如 ERR_PNPM_FETCH_404），可尝试：pnpm add @kulebbb/dsh-vision --config.auto-install-peers=false，然后重试；正常情况下不需要。
- 若你没有执行命令的能力，请把上述命令与 yaml 片段整理成一份手动操作清单交给我。
- 需要我确认的信息（如 API Key 的获取方式）先问我，再继续。
```

**English**

```text
You are an installation assistant. Install the DSH (DeepSeek Harness) plugin @kulebbb/dsh-vision into my web profile and configure it.

[Context]
@kulebbb/dsh-vision is a DSH adapter plugin that gives text-only DeepSeek models vision by describing images through an OpenAI-compatible vision model. Its @deepseek-ai/* runtime dependencies are provided by the DSH installation itself — do not (and cannot) install them separately.

[Preflight]
1. Run dsh --version to confirm DSH is installed; if the command is missing, tell me "dsh is not installed" and stop.
2. Confirm the directory ~/.dsh/profiles/web (or $DSH_HOME/profiles/web) exists; if not, run dsh web once to initialize it.

[Install]
1. cd ~/.dsh/profiles/web
2. Run: pnpm add @kulebbb/dsh-vision
3. Open (or create) cordis.patch.yml and APPEND the following entry to the top-level insert list. Note: - insert: is a top-level list item of the file — write it flush-left (strip the leading whitespace from every line) while keeping the inner indentation as-is; do not overwrite or modify other entries. If an entry with id dsh-vision already exists, update only its name and config:
   - insert:
       - id: dsh-vision
         name: '@kulebbb/dsh-vision'
         config:
           deepseek:
             apiKeyEnv: DEEPSEEK_API_KEY
           vision:
             baseUrl: https://dashscope.aliyuncs.com/compatible-mode/v1
             model: qwen-vl-max
             apiKeyEnv: VISION_API_KEY
   Note: apiKeyEnv is a credential reference name. Remind me to provide DEEPSEEK_API_KEY and VISION_API_KEY via environment variables or $DSH_HOME/.credentials.yaml; never write real secrets into the yaml file.
4. Restart dsh web (if it is running).

[Verify]
- Run dsh --profile web --dump-config and confirm the output contains id: dsh-vision and name: '@kulebbb/dsh-vision'.
- After restart: Settings shows a "Vision" section; the model picker offers the deepseek-vision provider; pasting an image no longer errors with "select an image-capable model".

[On errors]
- If any command fails, relay the full error to me verbatim; do not improvise config changes or fall back to other approaches.
- If pnpm reports peer-dependency errors (e.g. ERR_PNPM_FETCH_404), retry with: pnpm add @kulebbb/dsh-vision --config.auto-install-peers=false (normally not needed).
- If you cannot run commands, hand me a step-by-step manual checklist instead.
- Ask me before continuing whenever you need information I have not provided (e.g. how to obtain API keys).
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
cd plugins/dsh-vision && node --test
```

## License

[MIT](LICENSE)

window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-vision",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		const { createElement: h, useState, useEffect } = react;
		//#region locale dictionaries
		/** Dictionary namespace owned by this plugin. */
		const NS = "dshVisionSettings";
		/** Simplified Chinese copy. */
		const zh = {
			nav: "视觉",
			baseUrl: "端点 Base URL",
			model: "模型 Model",
			apiKeyEnv: "API Key 环境变量",
			apiKey: "API Key",
			apiKeyHint: "作为凭据存储，不写入设置文件；留空则保持当前密钥。",
			keyConfigured: "已配置",
			keyMissing: "未配置",
			timeoutMs: "超时 timeoutMs",
			maxImages: "最大图片数 maxImages",
			save: "保存",
			saving: "保存中…",
			saved: "已保存",
			failed: "保存失败"
		};
		/** English copy, kept complete against the zh key set. */
		const en = {
			nav: "Vision",
			baseUrl: "Base URL",
			model: "Model",
			apiKeyEnv: "API key env",
			apiKey: "API Key",
			apiKeyHint: "Stored as a credential outside the settings file. Leave blank to keep the current key.",
			keyConfigured: "Configured",
			keyMissing: "Missing",
			timeoutMs: "Timeout (ms)",
			maxImages: "Max images",
			save: "Save",
			saving: "Saving…",
			saved: "Saved",
			failed: "Save failed"
		};
		//#endregion
		//#region styles
		const css = ".dshv_section{display:flex;flex-direction:column;gap:16px;max-width:560px;color:var(--dsw-alias-label-primary)}.dshv_field{display:flex;flex-direction:column;gap:6px}.dshv_label{font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)}.dshv_input{height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:0 12px;font:inherit;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}.dshv_input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.dshv_input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.dshv_hint{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0}.dshv_head{display:flex;align-items:center;gap:8px}.dshv_badge{white-space:nowrap;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px;background:var(--dsw-alias-bg-module-platform)}.dshv_badgeConfigured{color:var(--dsw-alias-state-success-primary)}.dshv_badgeMissing{color:var(--dsw-alias-label-secondary)}.dshv_footer{display:flex;align-items:center;gap:8px}.dshv_button{appearance:none;font:inherit;cursor:pointer;border:none;border-radius:8px;padding:6px 16px;font-size:13px;line-height:1.5;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}.dshv_button:hover:not(:disabled){opacity:.85}.dshv_button:disabled{cursor:default;opacity:.5}.dshv_saved{font-size:12px;line-height:1.5;color:var(--dsw-alias-state-success-primary);margin:0}.dshv_failed{font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary);margin:0}";
		const STYLE_TAG = "dsh-vision-settings";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin=" + JSON.stringify(STYLE_TAG) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = STYLE_TAG;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		/** Subscribe a component to a bound settings-scope controller snapshot. */
		function useSettingsSnapshot(settings) {
			const [snapshot, setSnapshot] = useState(() => settings.getSnapshot());
			useEffect(() => {
				const dispose = settings.subscribe(() => setSnapshot(settings.getSnapshot()));
				return dispose;
			}, [settings]);
			return snapshot;
		}
		/** The Vision settings section: edit the vision backend and its API key. */
		function VisionSettingsSection({ t, settings, api }) {
			const snapshot = useSettingsSnapshot(settings);
			const vision = snapshot.value?.vision;
			const writable = snapshot.writable !== false;
			const apiKeyEnvRef = vision?.apiKeyEnv || "VISION_API_KEY";

			const [baseUrl, setBaseUrl] = useState("");
			const [model, setModel] = useState("");
			const [apiKeyEnv, setApiKeyEnv] = useState("");
			const [timeoutMs, setTimeoutMs] = useState("");
			const [maxImages, setMaxImages] = useState("");
			const [keyDraft, setKeyDraft] = useState("");
			const [keyConfigured, setKeyConfigured] = useState(false);
			const [saving, setSaving] = useState(false);
			const [status, setStatus] = useState(undefined);

			// Seed drafts from the resolved namespace value once available.
			useEffect(() => {
				if (vision === undefined) return;
				setBaseUrl(vision.baseUrl ?? "");
				setModel(vision.model ?? "");
				setApiKeyEnv(vision.apiKeyEnv ?? "");
				setTimeoutMs(vision.timeoutMs === undefined ? "" : String(vision.timeoutMs));
				setMaxImages(vision.maxImages === undefined ? "" : String(vision.maxImages));
			}, [vision]);

			// Read whether the referenced credential is configured.
			useEffect(() => {
				let alive = true;
				api.credentials.describe({ refs: [apiKeyEnvRef] }).then((response) => {
					if (!alive) return;
					if (!response?.result?.ok) {
						setKeyConfigured(false);
						return;
					}
					setKeyConfigured(response.result.value.credentials[apiKeyEnvRef]?.configured === true);
				}).catch(() => {
					if (alive) setKeyConfigured(false);
				});
				return () => {
					alive = false;
				};
			}, [api, apiKeyEnvRef]);

			const save = async () => {
				setSaving(true);
				setStatus(undefined);
				try {
					const timeout = Number(timeoutMs);
					const max = Number(maxImages);
					await settings.set("vision", {
						baseUrl: baseUrl.trim(),
						model: model.trim(),
						apiKeyEnv: apiKeyEnv.trim() || "VISION_API_KEY",
						timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 60000,
						maxImages: Number.isFinite(max) && max > 0 ? max : 5
					});
					if (keyDraft.trim() !== "") {
						await api.credentials.set({ ref: apiKeyEnvRef, value: keyDraft.trim() });
						setKeyDraft("");
					}
					setStatus("saved");
				} catch (_saveFailure) {
					setStatus("failed");
				} finally {
					setSaving(false);
				}
			};

			const disabled = !writable || saving;

			return h("div", { className: "dshv_section" }, [
				h("div", { className: "dshv_field" }, [
					h("label", { className: "dshv_label", htmlFor: "dshv-base-url" }, t("baseUrl")),
					h("input", {
						id: "dshv-base-url",
						className: "dshv_input",
						type: "text",
						value: baseUrl,
						disabled,
						onChange: (event) => setBaseUrl(event.target.value)
					})
				]),
				h("div", { className: "dshv_field" }, [
					h("label", { className: "dshv_label", htmlFor: "dshv-model" }, t("model")),
					h("input", {
						id: "dshv-model",
						className: "dshv_input",
						type: "text",
						value: model,
						disabled,
						onChange: (event) => setModel(event.target.value)
					})
				]),
				h("div", { className: "dshv_field" }, [
					h("label", { className: "dshv_label", htmlFor: "dshv-api-key-env" }, t("apiKeyEnv")),
					h("input", {
						id: "dshv-api-key-env",
						className: "dshv_input",
						type: "text",
						value: apiKeyEnv,
						disabled,
						onChange: (event) => setApiKeyEnv(event.target.value)
					})
				]),
				h("div", { className: "dshv_field" }, [
					h("div", { className: "dshv_head" }, [
						h("label", { className: "dshv_label", htmlFor: "dshv-api-key" }, t("apiKey")),
						h("span", {
							className: "dshv_badge " + (keyConfigured ? "dshv_badgeConfigured" : "dshv_badgeMissing")
						}, t(keyConfigured ? "keyConfigured" : "keyMissing"))
					]),
					h("input", {
						id: "dshv-api-key",
						className: "dshv_input",
						type: "password",
						autoComplete: "off",
						value: keyDraft,
						disabled,
						onChange: (event) => setKeyDraft(event.target.value)
					}),
					h("p", { className: "dshv_hint" }, t("apiKeyHint"))
				]),
				h("div", { className: "dshv_field" }, [
					h("label", { className: "dshv_label", htmlFor: "dshv-timeout" }, t("timeoutMs")),
					h("input", {
						id: "dshv-timeout",
						className: "dshv_input",
						type: "text",
						inputMode: "numeric",
						value: timeoutMs,
						disabled,
						onChange: (event) => setTimeoutMs(event.target.value)
					})
				]),
				h("div", { className: "dshv_field" }, [
					h("label", { className: "dshv_label", htmlFor: "dshv-max-images" }, t("maxImages")),
					h("input", {
						id: "dshv-max-images",
						className: "dshv_input",
						type: "text",
						inputMode: "numeric",
						value: maxImages,
						disabled,
						onChange: (event) => setMaxImages(event.target.value)
					})
				]),
				h("div", { className: "dshv_footer" }, [
					h("button", {
						type: "button",
						className: "dshv_button",
						disabled,
						onClick: save
					}, t(saving ? "saving" : "save")),
					status === "saved" ? h("p", { className: "dshv_saved", role: "status" }, t("saved")) : null,
					status === "failed" ? h("p", { className: "dshv_failed", role: "status" }, t("failed")) : null
				])
			]);
		}
		/** Required services (cordis fiber inject). */
		const inject = ["slots", "locale", "settingsScope"];
		/**
		 * Register the `dshVisionSettings` dictionaries and the Vision section,
		 * once the `settings.section` declaration is on the ledger.
		 * @param ctx - the browser plugin context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-vision: settings dictionaries");
			const t = ctx.locale.bind(NS);
			const settings = ctx.settingsScope.bind({ namespace: "dsh-vision" });
			const api = ctx.get("connection").api;
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "vision",
				order: 25,
				label: () => t("nav"),
				locale: NS,
				inject: () => ({ t, settings, api })
			}, VisionSettingsSection));
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

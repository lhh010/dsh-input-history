window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-input-history",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region src/client/history.ts
		/** The resting state: not browsing, nothing saved. */
		const IDLE = {
			index: null,
			savedDraft: ""
		};
		/**
		* Extract the plain-text of one user message: concatenated `text` blocks.
		* The blocks are treated structurally (any array works) so the module never
		* needs the LLM ContentBlock type — a cross-package dependency.
		* @param blocks - the message content blocks.
		* @returns the concatenated text, untrimmed.
		*/
		function textOf(blocks) {
			let text = "";
			for (const block of blocks) {
				if (typeof block !== "object" || block === null) continue;
				const record = block;
				if (record.type !== "text" || typeof record.text !== "string") continue;
				text += record.text;
			}
			return text;
		}
		/**
		* Build the recallable history for one session: every non-blank user
		* message, newest last, with adjacent duplicates collapsed (rapid re-sends
		* of the same text must not produce repeated recall entries).
		* @param nodes - the conversation snapshot nodes.
		* @returns history in chronological order; recall walks it backwards.
		*/
		function extractHistory(nodes) {
			const out = [];
			for (const node of nodes) {
				if (node.kind !== "user") continue;
				const trimmed = textOf(node.content).trim();
				if (trimmed === "") continue;
				const last = out[out.length - 1];
				if (last !== void 0 && last === trimmed) continue;
				out.push(trimmed);
			}
			return out;
		}
		/**
		* Ctrl+Up: enter history recall or move one entry older.
		* First press saves the current draft (the live state) and shows the newest
		* entry; subsequent presses walk older toward index 0.
		* @param history - extracted history (chronological).
		* @param draft - the composer draft at press time.
		* @param browse - current browse state.
		* @returns the next state and the text to fill.
		*/
		function up(history, draft, browse) {
			if (history.length === 0) return {
				browse,
				text: null
			};
			if (browse.index === null) {
				const nextIndex = history.length - 1;
				return {
					browse: {
						index: nextIndex,
						savedDraft: draft
					},
					text: history[nextIndex] ?? null
				};
			}
			if (browse.index === 0) return {
				browse,
				text: null
			};
			const nextIndex = browse.index - 1;
			return {
				browse: {
					...browse,
					index: nextIndex
				},
				text: history[nextIndex] ?? null
			};
		}
		/**
		* Ctrl+Down: move one entry newer, or return to live.
		* At the newest entry another press returns to live, restoring the draft
		* saved on the first Ctrl+Up (the empty draft restores as empty).
		* @param history - extracted history (chronological).
		* @param browse - current browse state.
		* @returns the next state and the text to fill (null while already live).
		*/
		function down(history, browse) {
			if (browse.index === null) return {
				browse,
				text: null
			};
			if (browse.index === history.length - 1) return {
				browse: IDLE,
				text: browse.savedDraft
			};
			const nextIndex = browse.index + 1;
			return {
				browse: {
					...browse,
					index: nextIndex
				},
				text: history[nextIndex] ?? null
			};
		}
		/**
		* Re-sync after the composer changed without our keyboard path (typing,
		* paste, a send clearing the draft, a new message arriving): any draft that
		* no longer equals the shown history entry drops the browse state, so the
		* next Ctrl+Up starts fresh from the newest entry.
		* @param history - extracted history (chronological).
		* @param draft - the current composer draft.
		* @param browse - current browse state.
		* @returns the resynced state.
		*/
		function resync(history, draft, browse) {
			if (browse.index === null) return browse;
			if (history[browse.index] === draft) return browse;
			return IDLE;
		}
		//#endregion
		//#region src/client/compat.ts
		/**
		* Graceful-compatibility helper: instead of throwing when the running DSH
		* client API no longer matches what this plugin needs, render a fixed-position
		* remediation banner and degrade. Pure DOM (appended to document.body), so it
		* works regardless of which slots/services the host still provides.
		*/
		/** Escape one text value for interpolation into the banner's innerHTML. */
		function escapeHtml(value) {
			return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
		}
		/** Fixed-position banner styling; injected once the first banner mounts. */
		const BANNER_CSS = [
			"position:fixed",
			"z-index:2147483000",
			"right:12px",
			"bottom:12px",
			"max-width:min(380px,calc(100vw - 24px))",
			"background:#1e2430",
			"color:#e6ebf2",
			"border:1px solid #f0a52a",
			"border-radius:10px",
			"padding:12px 14px",
			"font:13px/1.6 system-ui,Segoe UI,sans-serif",
			"box-shadow:0 8px 24px rgba(0,0,0,.35)"
		].join(";");
		/** One remediation banner; duplicates by id are dropped, click dismisses. */
		function renderCompatBanner(id, pluginName, cause, steps) {
			if (typeof document === "undefined") return;
			if (document.querySelector(`[data-dsh-compat-banner="${id}"]`) !== null) return;
			const el = document.createElement("div");
			el.setAttribute("data-dsh-compat-banner", id);
			el.setAttribute("role", "alert");
			el.setAttribute("style", BANNER_CSS);
			const list = steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
			el.innerHTML = [
				`<div style="font-weight:600;margin-bottom:4px">${escapeHtml(pluginName)} 与当前 DSH 不兼容</div>`,
				`<div style="margin-bottom:6px">原因：${escapeHtml(cause)}</div>`,
				`<div style="margin-bottom:4px">解决：</div>`,
				`<ol style="margin:0;padding-left:18px">${list}</ol>`,
				`<div style="margin-top:8px;color:#9aa4b2">点击关闭 · 更新后刷新页面即可</div>`
			].join("");
			el.addEventListener("click", () => {
				el.remove();
			});
			document.body.appendChild(el);
		}
		/** Fail-closed feature check: every required capability must be present. */
		function requireCapabilities(checks) {
			const missing = [];
			for (const [label, value] of checks) if (value === void 0 || value === null) missing.push(label);
			return missing;
		}
		/** Wrapper: run a plugin body, and on any missing capability or thrown error
		* render the remediation banner instead of crashing. */
		function applyWithCompat(pluginName, cause, steps, checks, body) {
			const missing = requireCapabilities(checks);
			if (missing.length > 0) {
				renderCompatBanner(pluginName, pluginName, `${cause}(缺失：${missing.join("、")})`, steps);
				return;
			}
			try {
				body();
			} catch (error) {
				renderCompatBanner(pluginName, pluginName, `${cause}(错误：${String(error?.message ?? error)})`, steps);
			}
		}
		//#endregion
		//#region src/client/index.ts
		/** Stable Cordis plugin name (matches the manifest id). */
		const name = "dsh-input-history";
		/**
		* Required services: the sessions face (current session + scope reads), the
		* target-neutral Conversation assembly (chat view nodes), and the
		* scope-addressed conversation face (input machine writes). All are
		* root-level services provided by the stock web app.
		*/
		const inject = [
			"sessions",
			"uiConversation",
			"conversation"
		];
		/**
		* Whether the keydown/input target is inside the conversation composer
		* surface. The composer is a contenteditable div hosted inside the
		* `data-input-scroll` frame, so the check stays robust against CSS-module
		* class hashing and contenteditable host changes.
		* @param target - the event target.
		* @returns true when the target is inside the composer.
		*/
		function isComposerTarget(target) {
			if (!(target instanceof HTMLElement)) return false;
			return target.closest("[data-input-scroll]") !== null;
		}
		const EMPTY_NODES = [];
		/**
		* Browser plugin body: capture Ctrl+Up / Ctrl+Down on the composer and drive
		* the input machine's draft through the pure history state machine. A live
		* composer edit or a session switch drops the browse state (the input event
		* re-sync covers both, plus sends clearing the draft).
		* @param ctx - client root context.
		*/
		function applyBody(ctx) {
			let browse = IDLE;
			let lastSessionId;
			const sessions = ctx.sessions;
			const resolve = () => {
				const id = sessions.list.getSnapshot().current;
				if (id === void 0) return null;
				if (id !== lastSessionId) {
					browse = IDLE;
					lastSessionId = id;
				}
				const actx = sessions.scope(id);
				if (actx === void 0) return null;
				const conversation = actx.get("conversation");
				if (conversation === void 0) return null;
				const chat = ctx.uiConversation.binding(id).snapshot.getSnapshot().views.get("chat");
				const nodes = chat === void 0 ? EMPTY_NODES : chat.legacy.nodes;
				return {
					input: conversation.input.for(actx),
					nodes
				};
			};
			const onKeyDown = (e) => {
				if (!e.ctrlKey || e.altKey || e.metaKey) return;
				if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
				if (e.isComposing) return;
				if (!isComposerTarget(e.target)) return;
				const resolved = resolve();
				if (resolved === null) return;
				const history = extractHistory(resolved.nodes);
				const draft = resolved.input.state.getSnapshot().draft;
				const step = e.key === "ArrowUp" ? up(history, draft, browse) : down(history, browse);
				const text = step.text;
				if (text === null) return;
				e.preventDefault();
				e.stopPropagation();
				browse = step.browse;
				resolved.input.setDraft(text);
			};
			const onInput = (e) => {
				if (!isComposerTarget(e.target)) return;
				const resolved = resolve();
				if (resolved === null) return;
				browse = resync(extractHistory(resolved.nodes), resolved.input.state.getSnapshot().draft, browse);
			};
			ctx.effect(() => {
				window.addEventListener("keydown", onKeyDown, true);
				window.addEventListener("input", onInput, true);
				return () => {
					window.removeEventListener("keydown", onKeyDown, true);
					window.removeEventListener("input", onInput, true);
				};
			}, "dsh-input-history: composer keyboard capture");
		}
		/**
		* Client plugin entry: run {@link applyBody} behind a graceful-compatibility
		* guard — when the running DSH lacks the client APIs this plugin needs, a
		* remediation banner renders instead of a thrown activation error.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			applyWithCompat("@dsh-external/dsh-input-history", "当前 DSH 客户端 API 与插件不匹配", [
				"将 DSH 升级到已适配的版本（dsh-v0.1.2-alpha.1，源码构建安装）。",
				"或将插件更新到适配当前 DSH 的版本（仓库最新 tag）。",
				"如仍显示，请在插件目录执行 pnpm run build 后刷新页面。"
			], [
				["sessions.list", ctx?.sessions?.list],
				["sessions.scope", ctx?.sessions?.scope],
				["sessions.sessionOf", ctx?.sessions?.sessionOf],
				["uiConversation.binding", ctx?.uiConversation?.binding]
			], () => {
				applyBody(ctx);
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

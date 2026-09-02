# dsh-input-history

> 兼容 DSH `dsh-v0.1.2-alpha.3`（typecheck/build + 18 单测全绿，实机验证）

DSH Web 输入历史插件：像终端一样用 **Ctrl+Up / Ctrl+Down** 召回和切换已发送的消息，零核心改动。

> **你的 DSH 版本决定装哪个插件版本**（装错会崩：常见症状 `useConversation is not a function`）
> - DSH **0.1.1-rc.2**（npm 最新）：装**旧版** `'@dsh-external/dsh-input-history@github:lhh010/dsh-input-history#v0.1.2'`
> - DSH **0.1.2-alpha.1 / alpha.2 / alpha.3 / alpha.4 / alpha.5**：装**新版**（下方默认命令）
## 安装（profile 模式）

```sh
# 方式一：git 依赖固定 tag（公开镜像，推荐；也可用 github:lhh010/dsh-input-history）
dsh plugin --profile web add '@dsh-external/dsh-input-history@github:lhh010/dsh-input-history#v0.1.7'

# 方式二：本地 link（开发）
git clone https://github.com/lhh010/dsh-input-history.git
cd dsh-input-history && pnpm install && pnpm run build
dsh plugin --profile web add link:/path/to/dsh-input-history
```

配置行（`$DSH_HOME/profiles/web/cordis.patch.yml`，热重载，无需重启）：

```yaml
- insert:
    - id: dsh-input-history
      name: '@dsh-external/dsh-input-history'
```

> **安装提示**：pnpm 11 首次安装可能拦截 node-pty 等构建脚本——在 `~/.dsh/profiles/web` 下执行 `pnpm approve-builds --all` 放行后重跑安装命令即可；装完**硬刷新浏览器**（Ctrl/Cmd+Shift+R）。

### 提示词安装（让 DSH 自己装）

把下面这段提示词发给任意一个 DSH 会话，模型会替你完成安装：

> 帮我安装 dsh-input-history 插件（DSH 输入历史召回插件（Ctrl+Up/Ctrl+Down 终端式输入历史）），步骤：
> 1. 执行 `dsh plugin --profile web add '@dsh-external/dsh-input-history@github:lhh010/dsh-input-history#v0.1.7'`（首次可能被 pnpm 11 拦截 node-pty 构建脚本而失败）
> 2. 在 `~/.dsh/profiles/web` 下执行 `pnpm approve-builds --all`（放行构建脚本）
> 3. 再执行一次第 1 步的安装命令
> 4. 完成后提醒我硬刷新浏览器（Ctrl/Cmd+Shift+R）
> 遇到报错先查 https://github.com/lhh010/dsh-input-history README 的常见问题/已知限制。


（npm 发版不再发布 `cordis` 名义的 vendored 包），本插件已迁移（peer 声明 `@deepseek-ai/cordis: ^4.0.1-rc.1`，npm rc.5 基线上为 `4.0.1-rc.4`），纯 `npm install` 不再报 ERESOLVE。

### 0809 兼容要点（实机验证）

- **加载机制变化**：0809 重构了客户端插件机制——旧的 `dsh.plugin.json` 清单 + `resolveClientPath`（`packages/plugin/plugin`）已删除，改为 **package.json 的 `dshClient` 声明**（`platform: 'web'`，可选 `inject`/`immediately`）+ `exports["./client"]` 指向构建产物；宿主扫描 loader 条目组成 boot 图，Web 端从 `/plugins/<id>/client.js` 拉取。本插件 package.json 已满足该声明，无需改动。
- 依赖的官方输入门面 `conversation.input.for(actx).setDraft()` 与 `ConversationSnapshot.nodes` 会话快照在 0809 上保留，契约未变；键盘 capture 拦截不依赖任何槽位。
- **构建要求**：0809 宿主在激活时校验 `dshClient` 包的构建产物，缺失会抛 `ClientPackageCompositionError` 并**拒绝启动 `dsh web`**——升级快照或改源码后必须重新 `pnpm run build` 再启动，否则浏览器拉到的是旧 `lib/client.js`。

### 0810 兼容要点（snapshot0810）

- **元数据发现变化**：0810 的 ClientModuleHostService 在启动时扫描已加载插件的 package.json，但只读**嵌套 `dsh.client`**（`packages/client/modules/src/index.ts` 的 `resolveMeta`，`pkg.dsh.client`）；顶层 `dshClient` 字段读不到会静默丢出 boot 图——无日志、无报错，"启动顺利但插件全没"。本插件已从顶层 `dshClient` 迁移为嵌套 `dsh.client`（inject 原样保留）；`lib/client.js` 构建产物不变（package.json 不参与编译），symlink 安装改源仓库即生效，无需重装。

### 0811 兼容要点（snapshot0811，实机验证）

- **cordis 更名（本快照唯一影响本插件的官方变化）**：0811 将 vendored cordis 由 `cordis@4.0.0-rc.7` 更名为 **`@deepseek-ai/cordis@4.0.1-rc.1`**（官方 client 包随之全部改从 `@deepseek-ai/cordis` 导入）。本插件对 cordis 只有 type-only 导入（`src/index.ts`、`src/invariant.ts` 的 `import type { Context } from 'cordis'`），**构建产物（lib/*.js）零 cordis 运行时导入**——更名不影响已构建 bundle 的运行时加载；但源码对 npm rc.2 基线 typecheck 时 `cordis` 裸导入报 TS2307（仅此一处），**将类型导入迁移为 `from '@deepseek-ai/cordis'` 后全绿**。建议同步把 `peerDependencies.cordis` 迁移为 `@deepseek-ai/cordis: ^4.0.1-rc.1`。
- **实机 boot 验证**：snapshot0811（`snapshots/20260811T152241Z`）web 启动后 `window.__DSH_BOOT__` 清单包含 `@dsh-external/dsh-input-history`（inject: `dsh-client-runtime`/`dsh-client-ui-conversation`），`/plugins/@dsh-external/dsh-input-history/client.js` 返回 200；typecheck（含 tests）对 0811 基线通过。依赖的输入门面 `conversation.input.for(actx).setDraft()` 与 `ConversationSnapshot.nodes` 契约在 0811 上保持不变（0811 会话快照仅新增 `views` 字段，不影响 nodes 读取）。

### 0.1.1-rc.1 兼容要点（npm 发版 `@deepseek-ai/dsh@0.1.1-rc.1`，v0.1.2）

- **实机 boot 验证**：`dsh --profile web`（npm `0.1.1-rc.1`）启动后 `window.__DSH_BOOT__` 清单包含 `@dsh-external/dsh-input-history`（inject: `dsh-client-runtime`/`dsh-client-ui-conversation`），`/plugins/@dsh-external/dsh-input-history/client.js` 返回 200；依赖的输入门面 `conversation.input.for(actx).setDraft()` 与 `ConversationSnapshot.nodes` 契约在 0.1.1-rc.1 上保持不变，Ctrl+Up / Ctrl+Down 行为无回归

### 0812/最终快照 兼容要点（snapshots/20260812T172954Z-final，实机验证）

- **cordis 更名落地**：本插件已把 type-only 导入（`src/index.ts`、`src/invariant.ts` 的 `import type { Context } from '@deepseek-ai/cordis'`）与 `peerDependencies` 迁移至 `@deepseek-ai/cordis`（`^4.0.1-rc.1`；npm rc.5 基线上为 `@deepseek-ai/cordis@4.0.1-rc.4`）——构建产物（lib/*.js）依旧零 cordis 运行时导入，npm rc.5 消费者 typecheck 全绿，`npm install` 无需 `--legacy-peer-deps`。
- **invariants 源码包迁移（仅影响本地 typecheck）**：最终快照将 `@deepseek-ai/dsh-invariants` 源码包由 `packages/support/invariants` 移至 `packages/runtime-diagnostics/invariants`，devDependencies 路径已同步更新；服务名 `invariants` 与注册协议未变，运行不受影响。
- **实机 boot 验证**：最终快照（`snapshots/20260812T172954Z-final`）web 启动后 `window.__DSH_BOOT__` 清单包含 `@dsh-external/dsh-input-history`，`/plugins/@dsh-external/dsh-input-history/client.js` 返回 200；npm rc.5 consumer `dsh web` 启动后 boot 清单同样包含本插件。依赖的输入门面 `conversation.input.for(actx).setDraft()` 与 `ConversationSnapshot.nodes` 契约在最终快照与 rc.5 上保持不变（0811 新增的 `views` 与 `InputState.imageIds` 均不影响本插件读取的 nodes/draft 契约）。typecheck、build 与 18 个单测对最终快照基线通过。

### dsh-v0.1.2-alpha.1 兼容要点（v0.1.4）

- **服务面迁移**：旧 `@deepseek-ai/dsh-client-runtime/client` 包已删除。本插件类型迁移到 `@deepseek-ai/cordis`（Context）、`@deepseek-ai/dsh-api-session-controller/client`（ISessions）与 `@deepseek-ai/dsh-client-ui-conversation/client`（IConversation/SessionInput/ConversationNode），并通过 `@deepseek-ai/dsh-client-ui-chat/client` 的声明合并读取 chat 视图快照类型。
- **历史来源迁移**：会话快照不再携带 nodes。历史提取改走 Conversation 装配服务：`ctx.uiConversation.binding(sessionId).snapshot.getSnapshot().views.get('chat')?.legacy.nodes`（chat 视图的 legacy 兼容投影，user 节点结构不变，`kind === 'user'` 过滤与文本块拼接逻辑无需改动）。
- **输入门面保留**：`conversation.input.for(actx).setDraft()` 与 `input.state.getSnapshot().draft` 契约在 ui-conversation 的 Lexical 输入外壳（SessionInputShell）上保留；`setDraft` 自身把光标置于末尾，插件不再手动搬运 caret。
- **编辑器 DOM 变化**：composer 由 textarea 改为 contenteditable div（`data-composer-input`，仍位于 `data-input-scroll` 内）。目标判定放宽为"位于 `data-input-scroll` 内的元素"；草稿读取一律取输入机 published 的 clipboard 投影（contenteditable 的 DOM 文本无法还原 reference chip）。
- **注册范式**：插件导出 `inject = ['sessions', 'uiConversation', 'conversation']`，apply 内直接读 `ctx.sessions` / `ctx.uiConversation`，不再使用 `ctx.inject([...], scope => ...)` 包装；`dsh.client.inject` 同步为 api-session-controller / ui-chat / ui-conversation 三个包名边。
本插件 v0.1.4 起内置**兼容性自诊断**：apply 时探测所需服务面(sessions/uiConversation),不满足时不再崩溃,而是在页面右下角渲染修复指引横幅(点击可关闭)。

## 功能

- **Ctrl+Up**：把最近一条已发送的用户消息填入输入框；连续按向上遍历更早的消息
- **Ctrl+Down**：向下遍历回更新的消息；回到最新位置时恢复你按 Ctrl+Up 之前未发送的草稿
- 裸方向键、Enter、Ctrl+Z/Y、斜杠菜单等全部原样放行——多行输入的光标移动不受影响（对应 [dsh-external/issues#153](https://github.com/dsh-external/issues/issues/153) 的约束）
- 历史来自当前会话快照的用户消息（自动去相邻重复、跳过空白），刷新页面后仍然可用
- 输入框被手动编辑、粘贴、或发送清空草稿后，浏览状态自动复位

## 安装（profile 模式）

```sh
# 方式一：git 依赖固定 tag（公开镜像，推荐；也可用 github:lhh010/dsh-input-history）
dsh plugin --profile web add '@dsh-external/dsh-input-history@github:lhh010/dsh-input-history#v0.1.7'

# 方式二：本地 link（开发）
git clone https://github.com/lhh010/dsh-input-history.git
cd dsh-input-history && pnpm install && pnpm run build
dsh plugin --profile web add link:/path/to/dsh-input-history
```

配置行（`$DSH_HOME/profiles/web/cordis.patch.yml`，热重载，无需重启）：

```yaml
- insert:
    - id: dsh-input-history
      name: '@dsh-external/dsh-input-history'
```

> **安装提示**：pnpm 11 首次安装可能拦截 node-pty 等构建脚本——在 `~/.dsh/profiles/web` 下执行 `pnpm approve-builds --all` 放行后重跑安装命令即可；装完**硬刷新浏览器**（Ctrl/Cmd+Shift+R）。

### 提示词安装（让 DSH 自己装）

把下面这段提示词发给任意一个 DSH 会话，模型会替你完成安装：

> 帮我安装 dsh-input-history 插件（DSH 输入历史召回插件（Ctrl+Up/Ctrl+Down 终端式输入历史）），步骤：
> 1. 执行 `dsh plugin --profile web add '@dsh-external/dsh-input-history@github:lhh010/dsh-input-history#v0.1.7'`（首次可能被 pnpm 11 拦截 node-pty 构建脚本而失败）
> 2. 在 `~/.dsh/profiles/web` 下执行 `pnpm approve-builds --all`（放行构建脚本）
> 3. 再执行一次第 1 步的安装命令
> 4. 完成后提醒我硬刷新浏览器（Ctrl/Cmd+Shift+R）
> 遇到报错先查 https://github.com/lhh010/dsh-input-history README 的常见问题/已知限制。

## 构建

```sh
pnpm install
pnpm run build      # lib/index.js + lib/invariant.js + lib/client.js
pnpm run test       # 纯逻辑单测
pnpm run typecheck
```

## 设计说明

- 纯浏览器端实现：无服务端行为（`src/index.ts` 是空壳），不向模型或会话日志注入任何内容
- 历史数据派生自 `ConversationSnapshot.nodes`（`kind === 'user'` 的文本块），不维护第二份状态
- 键盘在 document capture 阶段拦截，仅匹配 `Ctrl+ArrowUp/ArrowDown` 且焦点在会话输入框（`data-input-scroll` 内）时生效
- 草稿写入走官方输入门面 `conversation.input.for(actx).setDraft()`，与撤销/发送事务兼容

## Known Limitations and Deferred Work

- 历史仅覆盖当前会话（按 issue #153 语义）；跨会话/跨设备历史共享未实现
- 快照窗口外的旧消息不在召回范围内（窗口内必然包含最近发送的消息，实际影响很小）
- macOS 的 Cmd 修饰键未绑定（可扩展为配置项）
- 切换会话后浏览状态复位，不会跨会话续接


# dsh-input-history

DSH Web 输入历史插件：像终端一样用 **Ctrl+Up / Ctrl+Down** 召回和切换已发送的消息，零核心改动。

## 功能

- **Ctrl+Up**：把最近一条已发送的用户消息填入输入框；连续按向上遍历更早的消息
- **Ctrl+Down**：向下遍历回更新的消息；回到最新位置时恢复你按 Ctrl+Up 之前未发送的草稿
- 裸方向键、Enter、Ctrl+Z/Y、斜杠菜单等全部原样放行——多行输入的光标移动不受影响（对应 [dsh-external/issues#153](https://github.com/dsh-external/issues/issues/153) 的约束）
- 历史来自当前会话快照的用户消息（自动去相邻重复、跳过空白），刷新页面后仍然可用
- 输入框被手动编辑、粘贴、或发送清空草稿后，浏览状态自动复位

## 安装

在 DSH 的 `cordis.yml` 中注册插件（或使用 marisa / plugin-registry 安装）：

```yaml
plugins:
  '@dsh-external/dsh-input-history':
    path: /path/to/dsh-input-history
```

重启 `dsh web` 后，浏览器端插件会随页面加载（`/plugins/<id>/client.js`）。

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

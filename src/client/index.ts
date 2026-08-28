/**
 * dsh-input-history browser half: terminal-style input recall for the
 * conversation composer. Ctrl+Up fills the newest sent message into the
 * composer and walks older entries; Ctrl+Down walks back toward live and
 * restores the draft that was being edited when recall started. Both keys
 * are captured at the document level (capture phase) so they win over the
 * composer's own key handling, while bare ArrowUp/ArrowDown — and every
 * other chord — pass through untouched, so multi-line cursor movement and
 * the slash menu keep their native behavior (dsh-external/issues#153).
 *
 * History is derived from the live chat view snapshot (user messages in
 * the current window): no server round-trip, no duplicated state, and it
 * survives page refresh. Export discipline: packages/client/AGENTS.md — only
 * the cordis apply surface leaves this package.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: ISessions plus the ctx.sessions Context merge.
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
// Type-only: IConversation/SessionInput/ConversationNode plus the
// ctx.conversation / ctx.uiConversation Context merges.
import type {
  ConversationNode, IConversation, SessionInput,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: merges the 'chat' key into ConversationViewSnapshotMap so
// views.get('chat') resolves to ChatSnapshot.
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { down, extractHistory, IDLE, resync, up, type HistoryBrowse } from './history.ts'

/** Stable Cordis plugin name (matches the manifest id). */
export const name = 'dsh-input-history'

/**
 * Required services: the sessions face (current session + scope reads), the
 * target-neutral Conversation assembly (chat view nodes), and the
 * scope-addressed conversation face (input machine writes). All are
 * root-level services provided by the stock web app.
 */
export const inject = ['sessions', 'uiConversation', 'conversation']

/**
 * Whether the keydown/input target is inside the conversation composer
 * surface. The composer is a contenteditable div hosted inside the
 * `data-input-scroll` frame, so the check stays robust against CSS-module
 * class hashing and contenteditable host changes.
 * @param target - the event target.
 * @returns true when the target is inside the composer.
 */
function isComposerTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.closest('[data-input-scroll]') !== null
}

/** The per-press session resolution: current session, its input facade and chat nodes. */
interface ResolvedSession {
  readonly input: SessionInput
  readonly nodes: readonly ConversationNode[]
}

const EMPTY_NODES: readonly ConversationNode[] = []

/**
 * Browser plugin body: capture Ctrl+Up / Ctrl+Down on the composer and drive
 * the input machine's draft through the pure history state machine. A live
 * composer edit or a session switch drops the browse state (the input event
 * re-sync covers both, plus sends clearing the draft).
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  let browse: HistoryBrowse = IDLE
  let lastSessionId: string | undefined

  const sessions: ISessions = ctx.sessions

  const resolve = (): ResolvedSession | null => {
    const id = sessions.list.getSnapshot().current
    if (id === undefined) return null
    if (id !== lastSessionId) {
      // Session switch: recall must start fresh on the new session.
      browse = IDLE
      lastSessionId = id
    }
    const actx = sessions.scope(id)
    if (actx === undefined) return null
    const conversation = actx.get('conversation') as IConversation | undefined
    if (conversation === undefined) return null
    const chat = ctx.uiConversation.binding(id).snapshot.getSnapshot().views.get('chat')
    const nodes = chat === undefined ? EMPTY_NODES : chat.legacy.nodes
    return { input: conversation.input.for(actx), nodes }
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    // Only the plain Ctrl+ArrowUp/ArrowDown chord; every other key (bare
    // arrows, Ctrl+Z/Y undo/redo, IME composition, slash-menu chords) is
    // left to the composer.
    if (!e.ctrlKey || e.altKey || e.metaKey) return
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    if (e.isComposing) return
    if (!isComposerTarget(e.target)) return
    const resolved = resolve()
    if (resolved === null) return
    const history = extractHistory(resolved.nodes)
    const draft = resolved.input.state.getSnapshot().draft
    const step = e.key === 'ArrowUp'
      ? up(history, draft, browse)
      : down(history, browse)
    const text = step.text
    if (text === null) return
    e.preventDefault()
    e.stopPropagation()
    browse = step.browse
    // The Lexical-backed facade replaces the whole draft and places the
    // caret at the end itself (terminal recall semantics).
    resolved.input.setDraft(text)
  }

  // Any composer change not caused by our own recall drops the browse
  // state: typing, pasting, a send clearing the draft, or a recalled text
  // the user is now editing. The draft is read from the input machine's
  // published state (the clipboard projection), not the DOM: the
  // contenteditable host carries chips that a text read cannot reconstruct.
  const onInput = (e: Event): void => {
    if (!isComposerTarget(e.target)) return
    const resolved = resolve()
    if (resolved === null) return
    browse = resync(
      extractHistory(resolved.nodes),
      resolved.input.state.getSnapshot().draft,
      browse,
    )
  }

  ctx.effect(() => {
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('input', onInput, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('input', onInput, true)
    }
  }, 'dsh-input-history: composer keyboard capture')
}

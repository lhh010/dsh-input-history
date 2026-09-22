/**
 * dsh-input-history host half: registration shell plus the self-update
 * endpoint (latest-tag query and pinned install; see update-endpoint.ts).
 * The input-history keyboard capture itself lives entirely in the browser
 * bundle (exports["./client"]).
 */
import type { Context } from '@deepseek-ai/cordis'
import { registerUpdateEndpoint } from './update-endpoint.ts'

/** Stable Cordis plugin name (matches the manifest id). */
export const name = '@dsh-external/dsh-input-history'

/** Required service: the profile web server hosting the update routes. */
export const inject = ['webServer']

/**
 * Browser-side behavior plus the self-update endpoint.
 * @param ctx - host root context.
 */
export function apply(ctx: Context): void {
  registerUpdateEndpoint(ctx)
}

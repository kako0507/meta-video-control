import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createUrlWatcher } from '../../src/content/url-watcher'

describe('createUrlWatcher', () => {
  let originalPushState: typeof history.pushState
  let originalReplaceState: typeof history.replaceState

  beforeEach(() => {
    originalPushState = history.pushState
    originalReplaceState = history.replaceState
  })

  afterEach(() => {
    history.pushState = originalPushState
    history.replaceState = originalReplaceState
  })

  it('calls callback on pushState', () => {
    const cb = vi.fn()
    const stop = createUrlWatcher(cb)
    history.pushState({}, '', '/reels/abc123/')
    expect(cb).toHaveBeenCalledTimes(1)
    stop()
  })

  it('calls callback on replaceState', () => {
    const cb = vi.fn()
    const stop = createUrlWatcher(cb)
    history.replaceState({}, '', '/stories/user/1/')
    expect(cb).toHaveBeenCalledTimes(1)
    stop()
  })

  it('calls callback on popstate', () => {
    const cb = vi.fn()
    const stop = createUrlWatcher(cb)
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(cb).toHaveBeenCalledTimes(1)
    stop()
  })

  it('stop() removes the popstate listener', () => {
    const cb = vi.fn()
    const stop = createUrlWatcher(cb)
    stop()
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(cb).not.toHaveBeenCalled()
  })

  it('stop() restores original pushState', () => {
    const cb = vi.fn()
    const stop = createUrlWatcher(cb)
    stop()
    history.pushState({}, '', '/')
    expect(cb).not.toHaveBeenCalled()
  })
})

describe('createUrlWatcher with the Navigation API', () => {
  afterEach(() => {
    delete (globalThis as unknown as Record<string, unknown>).navigation
  })

  it('calls callback when the page navigates', () => {
    const nav = new EventTarget()
    ;(globalThis as unknown as Record<string, unknown>).navigation = nav
    const cb = vi.fn()
    const stop = createUrlWatcher(cb)
    nav.dispatchEvent(new Event('navigate'))
    expect(cb).toHaveBeenCalledTimes(1)
    stop()
  })

  it('leaves history.pushState untouched, since patching it cannot see page-world calls', () => {
    ;(globalThis as unknown as Record<string, unknown>).navigation = new EventTarget()
    const before = history.pushState
    const stop = createUrlWatcher(vi.fn())
    expect(history.pushState).toBe(before)
    stop()
  })

  it('stop() unsubscribes from the Navigation API', () => {
    const nav = new EventTarget()
    ;(globalThis as unknown as Record<string, unknown>).navigation = nav
    const cb = vi.fn()
    const stop = createUrlWatcher(cb)
    stop()
    nav.dispatchEvent(new Event('navigate'))
    expect(cb).not.toHaveBeenCalled()
  })
})

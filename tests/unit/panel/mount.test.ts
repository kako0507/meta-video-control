import { describe, it, expect, vi, afterEach } from 'vitest'
import { mountPanel } from '../../../src/panel/mount'

describe('mountPanel', () => {
  afterEach(() => {
    document.getElementById('ig-ctrl-host')?.remove()
  })

  it('appends a host element to document.body', () => {
    const video = document.createElement('video')
    const unmount = mountPanel(video)
    expect(document.getElementById('ig-ctrl-host')).not.toBeNull()
    unmount()
  })

  it('creates a shadow root on the host', () => {
    const video = document.createElement('video')
    const unmount = mountPanel(video)
    const host = document.getElementById('ig-ctrl-host')!
    expect(host.shadowRoot).not.toBeNull()
    unmount()
  })

  it('unmount() removes the host element', () => {
    const video = document.createElement('video')
    const unmount = mountPanel(video)
    unmount()
    expect(document.getElementById('ig-ctrl-host')).toBeNull()
  })

  it('only one host exists even if mountPanel is called twice', () => {
    const video = document.createElement('video')
    const unmount1 = mountPanel(video)
    const unmount2 = mountPanel(video)
    expect(document.querySelectorAll('#ig-ctrl-host').length).toBe(1)
    unmount1()
    unmount2()
  })
})

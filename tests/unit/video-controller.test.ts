import { describe, it, expect, vi, afterEach } from 'vitest'
import { createVideoController } from '../../src/content/video-controller'

vi.mock('../../src/panel/mount', () => ({
  mountPanel: vi.fn(() => vi.fn()),
}))

import { mountPanel } from '../../src/panel/mount'

describe('createVideoController', () => {
  afterEach(() => {
    vi.clearAllMocks()
    document.getElementById('ig-ctrl-host')?.remove()
  })

  it('calls mountPanel with the video on creation', () => {
    const video = document.createElement('video')
    createVideoController(video)
    expect(mountPanel).toHaveBeenCalledWith(video)
  })

  it('destroy() calls the unmount function returned by mountPanel', () => {
    const unmountFn = vi.fn()
    vi.mocked(mountPanel).mockReturnValue(unmountFn)
    const video = document.createElement('video')
    const controller = createVideoController(video)
    controller.destroy()
    expect(unmountFn).toHaveBeenCalledTimes(1)
  })

  it('destroy() can be called multiple times safely', () => {
    const unmountFn = vi.fn()
    vi.mocked(mountPanel).mockReturnValue(unmountFn)
    const video = document.createElement('video')
    const controller = createVideoController(video)
    controller.destroy()
    controller.destroy()
    expect(unmountFn).toHaveBeenCalledTimes(1)
  })
})

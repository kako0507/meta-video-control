import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import DownloadButton from '../../../src/panel/DownloadButton'

const URL_ = 'https://instagram.fna.fbcdn.net/o1/v/reel.mp4?sig=abc'

let clickedAnchor: HTMLAnchorElement | null = null

beforeEach(() => {
  clickedAnchor = null
  // jsdom has no object URL support, and the network is out of reach; both are
  // stubbed so the assertions can stay on what the component actually does.
  URL.createObjectURL = vi.fn(() => 'blob:stub')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    clickedAnchor = this
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function stubFetch(impl: () => Promise<unknown>) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

const okResponse = () =>
  Promise.resolve({ ok: true, blob: async () => new Blob(['video'], { type: 'video/mp4' }) })

describe('DownloadButton', () => {
  it('offers a download control before anything is clicked', () => {
    stubFetch(okResponse)
    render(<DownloadButton url={URL_} filename="DcQ7XESu_Yy.mp4" />)

    expect(screen.getByRole('button')).toHaveAccessibleName(/download/i)
  })

  it('saves the fetched video under the reel name', async () => {
    stubFetch(okResponse)
    render(<DownloadButton url={URL_} filename="DcQ7XESu_Yy.mp4" />)

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(clickedAnchor).not.toBeNull())
    expect(fetch).toHaveBeenCalledWith(URL_)
    expect(clickedAnchor!.download).toBe('DcQ7XESu_Yy.mp4')
    expect(clickedAnchor!.href).toContain('blob:stub')
  })

  it('releases the object URL once the save has been handed off', async () => {
    stubFetch(okResponse)
    render(<DownloadButton url={URL_} filename="DcQ7XESu_Yy.mp4" />)

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:stub'))
  })

  it('reports a failure when the signed url has expired', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')))
    render(<DownloadButton url={URL_} filename="DcQ7XESu_Yy.mp4" />)

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveAccessibleName(/failed/i)
    )
    expect(clickedAnchor).toBeNull()
  })

  it('treats a rejected signed url as a failure rather than saving the error body', async () => {
    stubFetch(() =>
      Promise.resolve({ ok: false, status: 403, blob: async () => new Blob(['denied']) })
    )
    render(<DownloadButton url={URL_} filename="DcQ7XESu_Yy.mp4" />)

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveAccessibleName(/failed/i)
    )
    expect(clickedAnchor).toBeNull()
  })
})

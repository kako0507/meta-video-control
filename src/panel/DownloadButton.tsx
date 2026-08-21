import { useState } from 'react'

interface Props {
  url: string
  filename: string
}

type Status = 'idle' | 'saving' | 'failed'

const LABEL: Record<Status, string> = {
  idle: 'Download video',
  saving: 'Downloading video',
  failed: 'Download failed — tap to retry',
}

const ICON: Record<Status, string> = {
  idle: '⤓',
  saving: '⋯',
  failed: '⚠',
}

export default function DownloadButton({ url, filename }: Props) {
  const [status, setStatus] = useState<Status>('idle')

  async function save() {
    if (status === 'saving') return
    setStatus('saving')
    try {
      const response = await fetch(url)
      // Instagram's CDN links are signed and expire, and an expired one comes
      // back as a normal response carrying an error body — not a rejection.
      if (!response.ok) throw new Error(`CDN responded ${response.status}`)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      // The anchor lives in the page document rather than the shadow root, so
      // the browser treats it as an ordinary same-origin download.
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
      setStatus('idle')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <button className="download-btn" aria-label={LABEL[status]} onClick={save}>
      {ICON[status]}
    </button>
  )
}

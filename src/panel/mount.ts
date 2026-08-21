import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import Panel from './Panel'
import panelCss from './panel.css?inline'

export function mountPanel(video: HTMLVideoElement): () => void {
  document.getElementById('ig-ctrl-host')?.remove()

  const host = document.createElement('div')
  host.id = 'ig-ctrl-host'
  Object.assign(host.style, {
    position: 'fixed',
    zIndex: '2147483647',
    pointerEvents: 'none',
  })

  const shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host as unknown as ShadowRoot

  const style = document.createElement('style')
  style.textContent = panelCss
  shadow.appendChild(style)

  const container = document.createElement('div')
  shadow.appendChild(container)

  document.body.appendChild(host)

  const root = createRoot(container)
  root.render(createElement(Panel, { video }))

  return () => {
    root.unmount()
    host.remove()
  }
}

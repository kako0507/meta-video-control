interface NavigationLike {
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

export function createUrlWatcher(onChange: () => void): () => void {
  // A content script runs in an isolated world, so patching history.pushState
  // here is invisible to the page's own calls — Instagram's navigations would
  // never be seen. The Navigation API does observe them, and also covers
  // back/forward, so it replaces the patch entirely where it exists.
  const navigation = (window as { navigation?: NavigationLike }).navigation
  if (navigation) {
    navigation.addEventListener('navigate', onChange)
    return () => navigation.removeEventListener('navigate', onChange)
  }

  const originalPushState = history.pushState
  const originalReplaceState = history.replaceState

  history.pushState = function (...args) {
    originalPushState.apply(this, args)
    onChange()
  }

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args)
    onChange()
  }

  window.addEventListener('popstate', onChange)

  return () => {
    history.pushState = originalPushState
    history.replaceState = originalReplaceState
    window.removeEventListener('popstate', onChange)
  }
}

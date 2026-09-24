import * as React from "react"

const MOBILE_BREAKPOINT = 768

const mediaQuery = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(mediaQuery)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function getSnapshot(): boolean {
  return window.matchMedia(mediaQuery).matches
}

function getServerSnapshot(): boolean {
  return false
}

export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

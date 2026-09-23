import * as React from "react"

const MOBILE_BREAKPOINT = 768

const subscribe = (onChange: () => void): (() => void) => {
  const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mediaQuery.addEventListener("change", onChange)
  return () => mediaQuery.removeEventListener("change", onChange)
}

const getSnapshot = (): boolean => window.innerWidth < MOBILE_BREAKPOINT
const getServerSnapshot = (): boolean => false

export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

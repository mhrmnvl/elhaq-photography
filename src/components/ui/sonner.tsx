"use client"

import {Toaster as Sonner, type ToasterProps} from "sonner"

// Colours live in globals.css (sonner CSS variables), so every toast type uses the theme primary.
function Toaster({...props}: ToasterProps) {
  return <Sonner theme="light" position="bottom-right" {...props} />
}

export {Toaster}

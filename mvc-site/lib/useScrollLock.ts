'use client'

import { useEffect } from 'react'

/**
 * Freezes the page behind a modal, and puts the reader back where they were on close.
 *
 * `overflow: hidden` on the body is the usual one-liner, but iOS Safari scrolls the
 * document anyway, which is exactly the case this needs to cover. Pinning the body with
 * `position: fixed` at a negative offset does hold, at the cost of having to remember the
 * scroll position and restore it — otherwise closing a modal dumps you at the top of the
 * page.
 *
 * Scroll containers inside the modal are unaffected; only the document behind is pinned.
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return

    const scrollY = window.scrollY
    const { style } = document.body
    const previous = {
      position: style.position,
      top: style.top,
      left: style.left,
      right: style.right,
      overflow: style.overflow,
    }

    style.position = 'fixed'
    style.top = `-${scrollY}px`
    style.left = '0'
    style.right = '0'
    style.overflow = 'hidden'

    return () => {
      style.position = previous.position
      style.top = previous.top
      style.left = previous.left
      style.right = previous.right
      style.overflow = previous.overflow
      window.scrollTo(0, scrollY)
    }
  }, [locked])
}

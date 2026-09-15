import { useEffect } from 'react'

// Track active references to font links in <head>
const fontRefCount = new Map()

/**
 * Loads specified Google Fonts safely into document head and cleans up on unmount.
 * Prevents memory leaks and head pollution across SPA navigations.
 *
 * @param {Array<string|{family: string, weight?: string, style?: string}>} fonts
 */
export default function useGoogleFonts(fonts = []) {
  useEffect(() => {
    if (!fonts || fonts.length === 0) return

    const fontFamilies = fonts.map(f => {
      if (typeof f === 'string') return f.replace(/["']/g, '').trim()
      return (f.family || '').replace(/["']/g, '').trim()
    }).filter(Boolean)

    if (fontFamilies.length === 0) return

    const loadedLinks = []

    fontFamilies.forEach(family => {
      const familySlug = family.toLowerCase().replace(/[^a-z0-9]/g, '-')
      const linkId = `google-font-${familySlug}`

      const currentCount = fontRefCount.get(linkId) || 0
      fontRefCount.set(linkId, currentCount + 1)

      let linkElem = document.getElementById(linkId)
      if (!linkElem) {
        linkElem = document.createElement('link')
        linkElem.id = linkId
        linkElem.rel = 'stylesheet'
        // Construct standard Google Fonts CSS URL
        const encodedFamily = encodeURIComponent(family)
        linkElem.href = `https://fonts.googleapis.com/css2?family=${encodedFamily}:ital,wght@0,400;0,700;1,400;1,700&display=swap`
        document.head.appendChild(linkElem)
      }

      loadedLinks.push(linkId)
    })

    return () => {
      // Reference-counted cleanup on unmount
      loadedLinks.forEach(linkId => {
        const currentCount = fontRefCount.get(linkId) || 1
        if (currentCount <= 1) {
          fontRefCount.delete(linkId)
          const linkElem = document.getElementById(linkId)
          if (linkElem?.parentNode) {
            linkElem.parentNode.removeChild(linkElem)
          }
        } else {
          fontRefCount.set(linkId, currentCount - 1)
        }
      })
    }
  }, [JSON.stringify(fonts)])
}

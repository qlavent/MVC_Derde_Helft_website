export default function InstagramPage() {
  return (
    <div className="min-h-screen">
      <div className="px-4 pt-12 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden border flex-shrink-0" style={{ borderColor: 'var(--sand)' }}>
            <img src="/logo.jpg" alt="logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-black">Instagram</h1>
        </div>
        <p className="text-xs text-[var(--subtle)] mt-1">@mvc.den.derde.helft</p>
      </div>

      {/* Follow button */}
      <div className="px-4 mb-6">
        <a
          href="https://www.instagram.com/mvc.den.derde.helft"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-purple-600 to-orange-400 text-white rounded-2xl py-4 font-bold text-sm"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
          Volg ons op Instagram
        </a>
      </div>

      {/* Behold.so embed placeholder */}
      <div className="px-4">
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 text-center">
          <p className="text-[var(--subtle)] text-sm mb-2">Instagram feed</p>
          <p className="text-xs text-[var(--subtle2)]">
            Maak een gratis account aan op{' '}
            <a href="https://behold.so" target="_blank" rel="noopener noreferrer" className="text-[var(--sand)] underline">
              behold.so
            </a>
            , verbind je Instagram account en plak de embed code hieronder in de code.
          </p>
          {/* PASTE BEHOLD EMBED CODE HERE */}
          {/* <div id="behold-widget-xxx"></div><script src="..."></script> */}
        </div>
      </div>
    </div>
  )
}

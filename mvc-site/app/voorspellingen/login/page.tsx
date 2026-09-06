'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * Magic link only — no passwords anywhere in this section.
 *
 * The link points back at /voorspellingen and supabase-js picks the session out of the URL
 * hash itself (`detectSessionInUrl` is on by default), so there is no callback route.
 *
 * NOT wrapped in AuthGate: this is where the gate sends people.
 */
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/voorspellingen')
    })
  }, [router])

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    const address = email.trim()
    if (!address) return
    setSending(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: `${window.location.origin}/voorspellingen` },
    })
    setSending(false)
    if (error) setError(dutchAuthError(error))
    else setSent(true)
  }

  return (
    <div className="px-4">
      <div className="ucl-card p-5">
        {sent ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Mail size={16} className="text-[var(--sand)]" />
              <h2 className="text-base font-bold">Check je mail</h2>
            </div>
            <p className="text-sm text-[var(--subtle)] leading-relaxed">
              We hebben een inloglink gestuurd naar <span className="text-[var(--fg)] break-all">{email.trim()}</span>.
              Open die op deze telefoon en je zit binnen.
            </p>
            <p className="text-sm text-[var(--subtle)] leading-relaxed mt-3">
              De link werkt één keer en vervalt na een uur. Niets ontvangen? Kijk ook in je
              spam.
            </p>
            <button
              onClick={() => setSent(false)}
              className="w-full mt-5 text-sm text-[var(--subtle)] py-2"
            >
              Ander adres gebruiken
            </button>
          </>
        ) : (
          <form onSubmit={sendLink}>
            <h2 className="text-base font-bold mb-1">Inloggen</h2>
            <p className="text-sm text-[var(--subtle)] leading-relaxed mb-4">
              Vul je e-mailadres in. Je krijgt een link waarmee je meteen binnen bent — geen
              wachtwoord nodig.
            </p>
            {/* text-base is 16px on purpose: iOS zooms into any focused field below that and
                never zooms back out. Same reason as the event forms. */}
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="jij@voorbeeld.be"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-base rounded-xl px-4 py-3 bg-[var(--muted)] text-[var(--fg)] placeholder-[var(--subtle)] border border-[var(--border)] focus:outline-none"
            />
            {error && (
              <p className="text-sm text-red-400 leading-relaxed mt-3">{error}</p>
            )}
            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="w-full mt-4 rounded-xl py-3 font-bold bg-[var(--sand)] text-[var(--sand-fg)] disabled:opacity-40"
            >
              {sending ? 'Versturen…' : 'Stuur inloglink'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

/**
 * Real reasons, in Dutch. Rate limiting is the likely one for now: Supabase's built-in sender
 * allows only a handful of mails an hour, so the second and third player to try in the same
 * evening get a 429 rather than a mail.
 */
function dutchAuthError(error: { message: string; status?: number }): string {
  const m = error.message.toLowerCase()
  if (error.status === 429 || m.includes('rate limit') || m.includes('security purposes')) {
    return 'Te veel aanvragen op korte tijd. De mailserver laat maar een paar inloglinks per uur door. Wacht een tiental minuten en probeer opnieuw.'
  }
  if (m.includes('email') && (m.includes('invalid') || m.includes('valid'))) {
    return 'Dat lijkt geen geldig e-mailadres.'
  }
  return `Versturen lukte niet: ${error.message}`
}

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function KitCarrierBanner() {
  const [name, setName] = useState<string | null>(null)

  async function fetch() {
    const { data } = await supabase
      .from('kit_carriers')
      .select('player:players(first_name, last_name)')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    const p = data?.player as unknown as { first_name: string; last_name: string } | null
    const player = Array.isArray(p) ? p[0] : p
    setName(player ? `${player.first_name} ${player.last_name}` : null)
  }

  useEffect(() => {
    fetch()
    const interval = setInterval(fetch, 30000)
    return () => clearInterval(interval)
  }, [])

  if (!name) return null

  return (
    <div className="mx-4 mb-3">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3 flex items-center gap-3">
        <span className="text-xl">🎽</span>
        <div>
          <p className="text-xs text-[var(--subtle)]">Truitjes</p>
          <p className="text-sm font-bold">{name} heeft de truitjes</p>
        </div>
      </div>
    </div>
  )
}

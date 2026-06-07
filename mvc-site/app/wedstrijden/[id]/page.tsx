'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Match, Player, Goal, Corner, Card, Motm, KitCarrier } from '@/lib/types'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { ChevronLeft, Plus, Shuffle, X } from 'lucide-react'
import Link from 'next/link'

type Tab = 'info' | 'doelpunten' | 'corners' | 'kaarten'

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [match, setMatch] = useState<Match | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [corners, setCorners] = useState<Corner[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [motm, setMotm] = useState<Motm | null>(null)
  const [kitCarrier, setKitCarrier] = useState<KitCarrier | null>(null)
  const [tab, setTab] = useState<Tab>('info')
  const [loading, setLoading] = useState(true)

  // Modals
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [showCornerModal, setShowCornerModal] = useState(false)
  const [showCardModal, setShowCardModal] = useState(false)
  const [showKitModal, setShowKitModal] = useState(false)
  const [showPlayerModal, setShowPlayerModal] = useState(false)

  const fetchAll = useCallback(async () => {
    const [
      { data: matchData },
      { data: allPlayers },
      { data: matchPlayerRows },
      { data: goalData },
      { data: cornerData },
      { data: cardData },
      { data: motmData },
      { data: kitData },
    ] = await Promise.all([
      supabase.from('matches').select('*').eq('id', id).single(),
      supabase.from('players').select('*').order('last_name'),
      supabase.from('match_players').select('player_id').eq('match_id', id),
      supabase.from('goals').select('*, player:players(*)').eq('match_id', id).order('minute'),
      supabase.from('corners').select('*, taker:players!corners_taker_id_fkey(*), header:players!corners_header_id_fkey(*)').eq('match_id', id).order('minute'),
      supabase.from('cards').select('*, player:players(*)').eq('match_id', id).order('minute'),
      supabase.from('motm').select('*, player:players(*)').eq('match_id', id).single(),
      supabase.from('kit_carriers').select('*, player:players(*)').eq('match_id', id).single(),
    ])

    setMatch(matchData)
    setPlayers(allPlayers ?? [])
    const selIds = new Set(matchPlayerRows?.map((r) => r.player_id) ?? [])
    setSelectedPlayers((allPlayers ?? []).filter((p) => selIds.has(p.id)))
    setGoals((goalData ?? []) as Goal[])
    setCorners((cornerData ?? []) as Corner[])
    setCards((cardData ?? []) as Card[])
    setMotm(motmData as Motm | null)
    setKitCarrier(kitData as KitCarrier | null)
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [fetchAll])

  if (loading || !match) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--sand)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const homeScore = match.manual_home_score ?? match.rbfa_home_score
  const awayScore = match.manual_away_score ?? match.rbfa_away_score

  async function updateScore(field: 'manual_home_score' | 'manual_away_score', delta: number) {
    const current = field === 'manual_home_score' ? (match!.manual_home_score ?? 0) : (match!.manual_away_score ?? 0)
    const newVal = Math.max(0, current + delta)
    await supabase.from('matches').update({ [field]: newVal }).eq('id', id)
    fetchAll()
  }

  async function addGoal(playerId: string, isCornerGoal: boolean, minute: number | null) {
    await supabase.from('goals').insert({ match_id: id, player_id: playerId, minute, is_corner_goal: isCornerGoal })
    setShowGoalModal(false)
    fetchAll()
  }

  async function addCorner(takerId: string, headerId: string, minute: number | null, isGoal: boolean) {
    await supabase.from('corners').insert({ match_id: id, taker_id: takerId, header_id: headerId, minute, is_goal: isGoal })
    setShowCornerModal(false)
    fetchAll()
  }

  async function addCard(playerId: string, cardType: 'yellow' | 'red', minute: number | null) {
    await supabase.from('cards').insert({ match_id: id, player_id: playerId, minute, card_type: cardType, source: 'manual' })
    setShowCardModal(false)
    fetchAll()
  }

  async function setMotmPlayer(playerId: string) {
    await supabase.from('motm').upsert({ match_id: id, player_id: playerId }, { onConflict: 'match_id' })
    fetchAll()
  }

  async function addPlayerToSelection(playerId: string) {
    await supabase.from('match_players').upsert({ match_id: id, player_id: playerId, source: 'manual' }, { onConflict: 'match_id,player_id' })
    setShowPlayerModal(false)
    fetchAll()
  }

  async function removePlayerFromSelection(playerId: string) {
    await supabase.from('match_players').delete().eq('match_id', id).eq('player_id', playerId)
    fetchAll()
  }

  async function pickRandomKitCarrier(excludeIds: string[]) {
    const pool = selectedPlayers.length > 0 ? selectedPlayers : players
    const eligible = pool.filter((p) => !excludeIds.includes(p.id))
    if (!eligible.length) return
    const picked = eligible[Math.floor(Math.random() * eligible.length)]
    await supabase.from('kit_carriers').upsert({ match_id: id, player_id: picked.id }, { onConflict: 'match_id' })
    setShowKitModal(false)
    fetchAll()
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'doelpunten', label: 'Goals' },
    { key: 'corners', label: 'Corners' },
    { key: 'kaarten', label: 'Kaarten' },
  ]

  const playerName = (p?: Player | null) => p ? `${p.first_name} ${p.last_name}` : '—'

  return (
    <div className="min-h-screen">
      {/* Back */}
      <div className="px-4 pt-12 pb-2">
        <Link href="/wedstrijden" className="flex items-center gap-1 text-[var(--subtle)] text-sm">
          <ChevronLeft size={16} /> Wedstrijden
        </Link>
      </div>

      {/* Match header */}
      <div className="px-4 pb-4">
        <p className="text-xs text-[var(--subtle)] mb-2 text-center">{match.series_name} • {format(new Date(match.start_time), 'EEEE d MMM yyyy • HH:mm', { locale: nl })}</p>

        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-bold flex-1 ${match.is_home_game ? 'text-[var(--sand)]' : 'text-[var(--fg)]'}`}>
            {match.home_team_name}
          </span>

          {/* Score */}
          <div className="flex flex-col items-center">
            {match.state !== 'upcoming' ? (
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <button onClick={() => updateScore('manual_home_score', 1)} className="text-[var(--sand)] text-xl leading-none mb-1">+</button>
                  <span className="text-3xl font-black tabular-nums">{homeScore ?? 0}</span>
                  <button onClick={() => updateScore('manual_home_score', -1)} className="text-[var(--subtle2)] text-xl leading-none mt-1">−</button>
                </div>
                <span className="text-[var(--subtle2)] text-xl">—</span>
                <div className="flex flex-col items-center">
                  <button onClick={() => updateScore('manual_away_score', 1)} className="text-[var(--sand)] text-xl leading-none mb-1">+</button>
                  <span className="text-3xl font-black tabular-nums">{awayScore ?? 0}</span>
                  <button onClick={() => updateScore('manual_away_score', -1)} className="text-[var(--subtle2)] text-xl leading-none mt-1">−</button>
                </div>
              </div>
            ) : (
              <span className="text-lg text-[var(--subtle)]">{format(new Date(match.start_time), 'HH:mm')}</span>
            )}
            {match.rbfa_home_score !== null && (
              <p className="text-[10px] text-[var(--subtle2)] mt-1">Officieel: {match.rbfa_home_score}–{match.rbfa_away_score}</p>
            )}
          </div>

          <span className={`text-sm font-bold flex-1 text-right ${!match.is_home_game ? 'text-[var(--sand)]' : 'text-[var(--fg)]'}`}>
            {match.away_team_name}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-4 gap-1 mb-4 overflow-x-auto">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === key ? 'bg-[var(--sand)] text-black' : 'bg-[var(--surface)] text-[var(--subtle)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-4 pb-12">
        {/* INFO TAB */}
        {tab === 'info' && (
          <>
            {/* Selection */}
            <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Selectie</h3>
                <button onClick={() => setShowPlayerModal(true)} className="text-[var(--sand)] text-xs flex items-center gap-1">
                  <Plus size={12} /> Speler
                </button>
              </div>
              {selectedPlayers.length === 0 ? (
                <p className="text-xs text-[var(--subtle2)]">Nog geen selectie</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedPlayers.map((p) => (
                    <div key={p.id} className="flex items-center gap-1 bg-[var(--muted)] rounded-lg px-2 py-1">
                      <span className="text-xs">{p.first_name} {p.last_name}</span>
                      <button onClick={() => removePlayerFromSelection(p.id)} className="text-[var(--subtle2)] hover:text-red-400">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Kit carrier */}
            <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">🎽 Kleren</h3>
                <button onClick={() => setShowKitModal(true)} className="text-[var(--sand)] text-xs flex items-center gap-1">
                  <Shuffle size={12} /> Kies
                </button>
              </div>
              {kitCarrier ? (
                <p className="text-sm text-[var(--sand)] font-semibold">{playerName(kitCarrier.player)}</p>
              ) : (
                <p className="text-xs text-[var(--subtle2)]">Nog niemand aangeduid</p>
              )}
            </div>

            {/* MOTM */}
            <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)]">
              <h3 className="text-sm font-semibold mb-3">⭐ Man of the Match</h3>
              {motm ? (
                <p className="text-sm text-[var(--sand)] font-semibold">{playerName(motm.player)}</p>
              ) : (
                <p className="text-xs text-[var(--subtle2)] mb-2">Nog niet gekozen</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedPlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setMotmPlayer(p.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${motm?.player_id === p.id ? 'bg-[var(--sand)] text-black font-semibold' : 'bg-[var(--muted)] text-[var(--fg)]'}`}
                  >
                    {p.first_name} {p.last_name}
                  </button>
                ))}
              </div>
            </div>

            {/* Instagram */}
            <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)]">
              <h3 className="text-sm font-semibold mb-2">📸 Instagram post</h3>
              <input
                type="url"
                placeholder="https://instagram.com/p/..."
                defaultValue={match.instagram_post_url ?? ''}
                onBlur={async (e) => {
                  await supabase.from('matches').update({ instagram_post_url: e.target.value || null }).eq('id', id)
                }}
                className="w-full bg-[var(--muted)] rounded-lg px-3 py-2 text-sm text-[var(--fg)] placeholder-[var(--subtle)] border border-[var(--border)] focus:outline-none focus:border-[var(--sand)]"
              />
              {match.instagram_post_url && (
                <a href={match.instagram_post_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--sand)] mt-2 block">
                  Bekijk post →
                </a>
              )}
            </div>
          </>
        )}

        {/* GOALS TAB */}
        {tab === 'doelpunten' && (
          <div className="space-y-3">
            <button
              onClick={() => setShowGoalModal(true)}
              className="w-full bg-[var(--sand)] text-black rounded-2xl py-4 font-bold flex items-center justify-center gap-2"
            >
              <Plus size={20} /> Doelpunt toevoegen
            </button>
            {goals.length === 0 ? (
              <p className="text-center text-[var(--subtle2)] py-8">Nog geen doelpunten</p>
            ) : (
              goals.map((g) => (
                <div key={g.id} className="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)] flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{playerName(g.player)}</p>
                    {g.is_corner_goal && <span className="text-xs text-[var(--olive)]">Corner goal</span>}
                  </div>
                  {g.minute && <span className="text-xs text-[var(--subtle)]">{g.minute}&apos;</span>}
                </div>
              ))
            )}
          </div>
        )}

        {/* CORNERS TAB */}
        {tab === 'corners' && (
          <div className="space-y-3">
            <button
              onClick={() => setShowCornerModal(true)}
              className="w-full bg-[var(--olive)] text-[var(--fg)] rounded-2xl py-4 font-bold flex items-center justify-center gap-2"
            >
              <Plus size={20} /> Corner toevoegen
            </button>
            {corners.length === 0 ? (
              <p className="text-center text-[var(--subtle2)] py-8">Nog geen corners</p>
            ) : (
              corners.map((c) => (
                <div key={c.id} className="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[var(--subtle)]">Nemer</p>
                      <p className="text-sm font-semibold">{playerName(c.taker)}</p>
                    </div>
                    <div className="text-[var(--subtle2)]">→</div>
                    <div className="text-right">
                      <p className="text-xs text-[var(--subtle)]">Kopballer</p>
                      <p className="text-sm font-semibold">{playerName(c.header)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    {c.is_goal && <span className="text-xs bg-[var(--olive)]/30 text-[var(--olive)] px-2 py-0.5 rounded-full">⚽ Gescoord</span>}
                    {c.minute && <span className="text-xs text-[var(--subtle)]">{c.minute}&apos;</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* CARDS TAB */}
        {tab === 'kaarten' && (
          <div className="space-y-3">
            <button
              onClick={() => setShowCardModal(true)}
              className="w-full bg-[var(--surface)] border border-yellow-500/50 text-[var(--fg)] rounded-2xl py-4 font-bold flex items-center justify-center gap-2"
            >
              <Plus size={20} /> Kaart toevoegen
            </button>
            {cards.length === 0 ? (
              <p className="text-center text-[var(--subtle2)] py-8">Nog geen kaarten</p>
            ) : (
              cards.map((c) => (
                <div key={c.id} className="bg-[var(--surface)] rounded-xl p-3 border border-[var(--border)] flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{c.player ? playerName(c.player) : c.player_name_rbfa ?? '—'}</p>
                    {c.source === 'rbfa' && <span className="text-xs text-[var(--subtle2)]">RBFA</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {c.minute && <span className="text-xs text-[var(--subtle)]">{c.minute}&apos;</span>}
                    <span className={`w-5 h-7 rounded-sm ${c.card_type === 'yellow' ? 'bg-yellow-400' : 'bg-red-500'}`} />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* MODALS */}
      {showGoalModal && (
        <GoalModal
          players={selectedPlayers}
          onAdd={addGoal}
          onClose={() => setShowGoalModal(false)}
        />
      )}
      {showCornerModal && (
        <CornerModal
          players={selectedPlayers}
          onAdd={addCorner}
          onClose={() => setShowCornerModal(false)}
        />
      )}
      {showCardModal && (
        <CardModal
          players={selectedPlayers}
          onAdd={addCard}
          onClose={() => setShowCardModal(false)}
        />
      )}
      {showKitModal && (
        <KitModal
          players={selectedPlayers.length > 0 ? selectedPlayers : players}
          onPick={pickRandomKitCarrier}
          onClose={() => setShowKitModal(false)}
          allPlayers={players}
          onManualPick={async (pid) => {
            await supabase.from('kit_carriers').upsert({ match_id: id, player_id: pid }, { onConflict: 'match_id' })
            setShowKitModal(false)
            fetchAll()
          }}
        />
      )}
      {showPlayerModal && (
        <PlayerModal
          allPlayers={players}
          selectedIds={selectedPlayers.map((p) => p.id)}
          onAdd={addPlayerToSelection}
          onClose={() => setShowPlayerModal(false)}
        />
      )}
    </div>
  )
}

// --- Sub-components (modals) ---

function ModalWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-[var(--surface)] rounded-3xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose}><X size={20} className="text-[var(--subtle)]" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function GoalModal({ players, onAdd, onClose }: { players: Player[]; onAdd: (pid: string, isCorner: boolean, min: number | null) => void; onClose: () => void }) {
  const [playerId, setPlayerId] = useState('')
  const [minute, setMinute] = useState('')
  const [isCorner, setIsCorner] = useState(false)

  return (
    <ModalWrapper title="Doelpunt toevoegen" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-[var(--subtle)] mb-1 block">Speler</label>
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className="w-full bg-[var(--muted)] rounded-xl px-4 py-3 text-[var(--fg)] focus:outline-none">
            <option value="">Kies speler</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-[var(--subtle)] mb-1 block">Minuut (optioneel)</label>
          <input type="number" value={minute} onChange={(e) => setMinute(e.target.value)} placeholder="bv. 34" className="w-full bg-[var(--muted)] rounded-xl px-4 py-3 text-[var(--fg)] focus:outline-none" />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={isCorner} onChange={(e) => setIsCorner(e.target.checked)} className="w-5 h-5 rounded" />
          <span className="text-sm">Corner goal</span>
        </label>
        <button
          disabled={!playerId}
          onClick={() => onAdd(playerId, isCorner, minute ? parseInt(minute) : null)}
          className="w-full bg-[var(--sand)] text-black rounded-xl py-3 font-bold disabled:opacity-40"
        >
          Toevoegen
        </button>
      </div>
    </ModalWrapper>
  )
}

function CornerModal({ players, onAdd, onClose }: { players: Player[]; onAdd: (tid: string, hid: string, min: number | null, isGoal: boolean) => void; onClose: () => void }) {
  const [takerId, setTakerId] = useState('')
  const [headerId, setHeaderId] = useState('')
  const [minute, setMinute] = useState('')
  const [isGoal, setIsGoal] = useState(false)

  return (
    <ModalWrapper title="Corner toevoegen" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-[var(--subtle)] mb-1 block">Nemer</label>
          <select value={takerId} onChange={(e) => setTakerId(e.target.value)} className="w-full bg-[var(--muted)] rounded-xl px-4 py-3 text-[var(--fg)] focus:outline-none">
            <option value="">Kies nemer</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-[var(--subtle)] mb-1 block">Kopballer</label>
          <select value={headerId} onChange={(e) => setHeaderId(e.target.value)} className="w-full bg-[var(--muted)] rounded-xl px-4 py-3 text-[var(--fg)] focus:outline-none">
            <option value="">Kies kopballer</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
          </select>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-[var(--subtle)] mb-1 block">Minuut</label>
            <input type="number" value={minute} onChange={(e) => setMinute(e.target.value)} placeholder="bv. 12" className="w-full bg-[var(--muted)] rounded-xl px-4 py-3 text-[var(--fg)] focus:outline-none" />
          </div>
          <div className="flex items-end pb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isGoal} onChange={(e) => setIsGoal(e.target.checked)} className="w-5 h-5 rounded" />
              <span className="text-sm">Goal</span>
            </label>
          </div>
        </div>
        <button
          disabled={!takerId || !headerId}
          onClick={() => onAdd(takerId, headerId, minute ? parseInt(minute) : null, isGoal)}
          className="w-full bg-[var(--olive)] text-white rounded-xl py-3 font-bold disabled:opacity-40"
        >
          Toevoegen
        </button>
      </div>
    </ModalWrapper>
  )
}

function CardModal({ players, onAdd, onClose }: { players: Player[]; onAdd: (pid: string, type: 'yellow' | 'red', min: number | null) => void; onClose: () => void }) {
  const [playerId, setPlayerId] = useState('')
  const [cardType, setCardType] = useState<'yellow' | 'red'>('yellow')
  const [minute, setMinute] = useState('')

  return (
    <ModalWrapper title="Kaart toevoegen" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-[var(--subtle)] mb-1 block">Speler</label>
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className="w-full bg-[var(--muted)] rounded-xl px-4 py-3 text-[var(--fg)] focus:outline-none">
            <option value="">Kies speler</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
          </select>
        </div>
        <div className="flex gap-3">
          {(['yellow', 'red'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setCardType(t)}
              className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors ${cardType === t ? 'bg-[var(--muted)] ring-2 ring-[var(--sand)]' : 'bg-[var(--muted)]'}`}
            >
              <span className={`w-5 h-7 rounded-sm ${t === 'yellow' ? 'bg-yellow-400' : 'bg-red-500'}`} />
              <span className="text-sm">{t === 'yellow' ? 'Geel' : 'Rood'}</span>
            </button>
          ))}
        </div>
        <div>
          <label className="text-xs text-[var(--subtle)] mb-1 block">Minuut</label>
          <input type="number" value={minute} onChange={(e) => setMinute(e.target.value)} placeholder="bv. 55" className="w-full bg-[var(--muted)] rounded-xl px-4 py-3 text-[var(--fg)] focus:outline-none" />
        </div>
        <button
          disabled={!playerId}
          onClick={() => onAdd(playerId, cardType, minute ? parseInt(minute) : null)}
          className="w-full bg-[var(--sand)] text-black rounded-xl py-3 font-bold disabled:opacity-40"
        >
          Toevoegen
        </button>
      </div>
    </ModalWrapper>
  )
}

function KitModal({ players, allPlayers, onPick, onClose, onManualPick }: {
  players: Player[]
  allPlayers: Player[]
  onPick: (excludeIds: string[]) => void
  onClose: () => void
  onManualPick: (pid: string) => void
}) {
  const [excludeIds, setExcludeIds] = useState<string[]>([])
  const [manualId, setManualId] = useState('')

  function toggleExclude(id: string) {
    setExcludeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  return (
    <ModalWrapper title="Kleren toewijzen" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-xs text-[var(--subtle)] mb-2">Sluit spelers uit van de loting:</p>
          <div className="flex flex-wrap gap-2">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => toggleExclude(p.id)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${excludeIds.includes(p.id) ? 'bg-red-900/40 text-red-400 line-through' : 'bg-[var(--muted)] text-[var(--fg)]'}`}
              >
                {p.first_name} {p.last_name}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => onPick(excludeIds)}
          className="w-full bg-[var(--sand)] text-black rounded-xl py-3 font-bold flex items-center justify-center gap-2"
        >
          <Shuffle size={16} /> Willekeurig kiezen
        </button>
        <div className="border-t border-[var(--border)] pt-4">
          <p className="text-xs text-[var(--subtle)] mb-2">Of kies manueel:</p>
          <select value={manualId} onChange={(e) => setManualId(e.target.value)} className="w-full bg-[var(--muted)] rounded-xl px-4 py-3 text-[var(--fg)] focus:outline-none mb-3">
            <option value="">Kies speler</option>
            {allPlayers.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
          </select>
          <button disabled={!manualId} onClick={() => onManualPick(manualId)} className="w-full bg-[var(--muted)] text-[var(--fg)] rounded-xl py-3 font-semibold disabled:opacity-40">
            Bevestigen
          </button>
        </div>
      </div>
    </ModalWrapper>
  )
}

function PlayerModal({ allPlayers, selectedIds, onAdd, onClose }: { allPlayers: Player[]; selectedIds: string[]; onAdd: (pid: string) => void; onClose: () => void }) {
  const unselected = allPlayers.filter((p) => !selectedIds.includes(p.id))

  return (
    <ModalWrapper title="Speler toevoegen aan selectie" onClose={onClose}>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {unselected.map((p) => (
          <button
            key={p.id}
            onClick={() => onAdd(p.id)}
            className="w-full text-left px-4 py-3 bg-[var(--muted)] rounded-xl text-sm hover:bg-[var(--border)] transition-colors"
          >
            {p.first_name} {p.last_name}
          </button>
        ))}
        {unselected.length === 0 && <p className="text-center text-[var(--subtle2)] py-4">Alle spelers zijn al geselecteerd</p>}
      </div>
    </ModalWrapper>
  )
}

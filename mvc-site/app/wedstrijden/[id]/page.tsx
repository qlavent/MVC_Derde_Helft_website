'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Match, Player, Goal, Corner, Card, Motm, KitCarrier } from '@/lib/types'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { ChevronLeft, Plus, Shuffle, X } from 'lucide-react'
import Link from 'next/link'

type Tab = 'live' | 'info'

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
  const [tab, setTab] = useState<Tab>('live')
  const [loading, setLoading] = useState(true)

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
      supabase.from('goals').select('*, player:players(*)').eq('match_id', id).order('created_at'),
      supabase.from('corners').select('*, taker:players!corners_taker_id_fkey(*), header:players!corners_header_id_fkey(*)').eq('match_id', id).order('created_at'),
      // cards: order by id (created_at may not exist in older DB schemas)
      supabase.from('cards').select('*, player:players(*)').eq('match_id', id).order('id'),
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

  // Our score: regular goals (player set, not is_corner_goal) + corners with is_goal
  // Opponent score: goals with player_id = null (opponent goals entered via button)
  const ourScore =
    goals.filter((g) => g.player_id !== null && !g.is_corner_goal).length +
    corners.filter((c) => c.is_goal).length
  const opponentScore = goals.filter((g) => g.player_id === null).length

  const displayHomeScore = match.is_home_game ? ourScore : opponentScore
  const displayAwayScore = match.is_home_game ? opponentScore : ourScore
  const opponentName = match.is_home_game ? match.away_team_name : match.home_team_name

  async function addGoal(playerId: string) {
    await supabase.from('goals').insert({ match_id: id, player_id: playerId, is_corner_goal: false })
    setShowGoalModal(false)
    fetchAll()
  }

  async function addOpponentGoal() {
    await supabase.from('goals').insert({ match_id: id, player_id: null, is_corner_goal: false })
    fetchAll()
  }

  async function addCorner(takerId: string, headerId: string, isGoal: boolean) {
    await supabase.from('corners').insert({ match_id: id, taker_id: takerId, header_id: headerId, minute: null, is_goal: isGoal })
    setShowCornerModal(false)
    fetchAll()
  }

  async function addCard(playerId: string, cardType: 'yellow' | 'red') {
    await supabase.from('cards').insert({ match_id: id, player_id: playerId, minute: null, card_type: cardType, source: 'manual' })
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

  const playerName = (p?: Player | null) => (p ? `${p.first_name} ${p.last_name}` : '—')

  // Build unified timeline sorted oldest → newest (chat reads top=oldest, bottom=newest)
  type TlItem =
    | { kind: 'goal'; data: Goal; isOurs: boolean; ts: number; rowKey: string }
    | { kind: 'corner'; data: Corner; isOurs: true; ts: number; rowKey: string }
    | { kind: 'card'; data: Card; isOurs: true; ts: number; rowKey: string }

  const timeline: TlItem[] = [
    ...goals.map((g, i) => ({
      kind: 'goal' as const,
      data: g,
      isOurs: g.player_id !== null,
      ts: g.created_at ? new Date(g.created_at).getTime() : i,
      rowKey: `g-${g.id}`,
    })),
    ...corners.map((c, i) => ({
      kind: 'corner' as const,
      data: c,
      isOurs: true as const,
      ts: c.created_at ? new Date(c.created_at).getTime() : 1e13 + i,
      rowKey: `c-${c.id}`,
    })),
    ...cards.map((c, i) => ({
      kind: 'card' as const,
      data: c,
      isOurs: true as const,
      ts: c.created_at ? new Date(c.created_at).getTime() : 2e13 + i,
      rowKey: `k-${c.id}`,
    })),
  ].sort((a, b) => b.ts - a.ts)

  const matchDate = (() => {
    const r = new Date(match.start_time)
    return new Date(r.getTime() + r.getTimezoneOffset() * 60000)
  })()

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
        <p className="text-xs text-[var(--subtle)] mb-2 text-center">
          {match.series_name} • {format(matchDate, 'EEEE d MMM yyyy • HH:mm', { locale: nl })}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-bold flex-1 ${match.is_home_game ? 'text-[var(--sand)]' : 'text-[var(--fg)]'}`}>
            {match.home_team_name}
          </span>
          <div className="flex flex-col items-center">
            {match.state !== 'upcoming' ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black tabular-nums">{displayHomeScore}</span>
                  <span className="text-[var(--subtle2)]">—</span>
                  <span className="text-3xl font-black tabular-nums">{displayAwayScore}</span>
                </div>
                {match.rbfa_home_score !== null && (
                  <p className="text-[10px] text-[var(--subtle2)] mt-1">
                    Officieel: {match.rbfa_home_score}–{match.rbfa_away_score}
                  </p>
                )}
              </>
            ) : (
              <span className="text-lg text-[var(--subtle)]">{format(matchDate, 'HH:mm')}</span>
            )}
          </div>
          <span className={`text-sm font-bold flex-1 text-right ${!match.is_home_game ? 'text-[var(--sand)]' : 'text-[var(--fg)]'}`}>
            {match.away_team_name}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-4 gap-1 mb-4">
        {(['live', 'info'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === t ? 'bg-[var(--sand)] text-black' : 'bg-[var(--surface)] text-[var(--subtle)]'
            }`}
          >
            {t === 'live' ? 'Live' : 'Info'}
          </button>
        ))}
      </div>

      <div className="px-4 pb-28">
        {/* LIVE TAB */}
        {tab === 'live' && (
          <div className="space-y-4">
            {/* Action buttons — two columns matching scoreline sides */}
            {match.state !== 'upcoming' && (() => {
              const ourCol = (
                <div className="flex flex-col gap-2 flex-1">
                  <button
                    onClick={() => setShowGoalModal(true)}
                    className="bg-[var(--sand)] text-black rounded-2xl py-4 font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    ⚽ Doelpunt
                  </button>
                  <button
                    onClick={() => setShowCornerModal(true)}
                    className="bg-[var(--olive)] text-white rounded-2xl py-3 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    🎯 Corner
                  </button>
                  <button
                    onClick={() => setShowCardModal(true)}
                    className="bg-[var(--surface)] border border-yellow-500/40 text-[var(--fg)] rounded-2xl py-3 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    🟨 Kaart
                  </button>
                </div>
              )
              const oppCol = (
                <div className="flex flex-col gap-2 flex-1">
                  <button
                    onClick={addOpponentGoal}
                    className="bg-[var(--surface)] border border-[var(--border)] text-[var(--subtle)] rounded-2xl py-4 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    ⚽ {opponentName}
                  </button>
                </div>
              )
              return (
                <div className="flex gap-2">
                  {match.is_home_game ? <>{ourCol}{oppCol}</> : <>{oppCol}{ourCol}</>}
                </div>
              )
            })()}

            {/* Chat-style timeline */}
            {timeline.length === 0 ? (
              <p className="text-center text-[var(--subtle2)] py-8 text-sm">Nog geen events</p>
            ) : (
              <div className="space-y-2 pt-2">
                {timeline.map((ev) => {
                  const isOurs = ev.isOurs

                  let icon = ''
                  let label = ''
                  let sublabel = ''
                  let isDimmed = false
                  let deleteFn: () => void = () => {}

                  if (ev.kind === 'goal') {
                    const g = ev.data as Goal
                    icon = '⚽'
                    label = isOurs ? playerName(g.player) : opponentName
                    sublabel = 'Doelpunt'
                    deleteFn = async () => { await supabase.from('goals').delete().eq('id', g.id); fetchAll() }
                  } else if (ev.kind === 'corner') {
                    const c = ev.data as Corner
                    if (c.is_goal) {
                      icon = '⚽'
                      sublabel = 'Corner goal'
                    } else {
                      icon = '🎯'
                      sublabel = 'Corner gemist'
                      isDimmed = true
                    }
                    label = `${playerName(c.taker)} → ${playerName(c.header)}`
                    deleteFn = async () => { await supabase.from('corners').delete().eq('id', c.id); fetchAll() }
                  } else {
                    const c = ev.data as Card
                    icon = (c.card_type === 'yellow') ? '🟨' : '🟥'
                    label = c.player ? playerName(c.player) : c.player_name_rbfa ?? '—'
                    sublabel = c.card_type === 'yellow' ? 'Gele kaart' : 'Rode kaart'
                    deleteFn = async () => { await supabase.from('cards').delete().eq('id', c.id); fetchAll() }
                  }

                  // Home team → left, away team → right (mirrors scoreline)
                  const isLeftAligned = (isOurs && match.is_home_game) || (!isOurs && !match.is_home_game)
                  const bubbleCls = isOurs
                    ? isDimmed ? 'bg-[var(--muted)] text-[var(--subtle)]' : 'bg-[var(--sand)] text-black'
                    : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--fg)]'
                  const subCls = (isOurs && !isDimmed) ? 'opacity-60' : 'text-[var(--subtle)]'
                  const tailCls = isLeftAligned ? 'rounded-bl-sm' : 'rounded-br-sm'

                  if (isLeftAligned) {
                    return (
                      <div key={ev.rowKey} className="flex justify-start items-end gap-2">
                        <div className={`${bubbleCls} rounded-2xl ${tailCls} px-4 py-3 max-w-[70%]`}>
                          <p className="text-sm font-bold leading-tight">{label}</p>
                          <p className={`text-xs mt-0.5 ${subCls}`}>{icon} {sublabel}</p>
                        </div>
                        <button onClick={deleteFn} className="text-red-400/40 hover:text-red-400 transition-colors p-1 mb-1 flex-shrink-0">
                          <X size={13} />
                        </button>
                      </div>
                    )
                  } else {
                    return (
                      <div key={ev.rowKey} className="flex justify-end items-end gap-2">
                        <button onClick={deleteFn} className="text-red-400/40 hover:text-red-400 transition-colors p-1 mb-1 flex-shrink-0">
                          <X size={13} />
                        </button>
                        <div className={`${bubbleCls} rounded-2xl ${tailCls} px-4 py-3 max-w-[70%]`}>
                          <p className="text-sm font-bold leading-tight">{label}</p>
                          <p className={`text-xs mt-0.5 ${subCls}`}>{icon} {sublabel}</p>
                        </div>
                      </div>
                    )
                  }

                })}
              </div>
            )}
          </div>
        )}

        {/* INFO TAB */}
        {tab === 'info' && (
          <div className="space-y-4">
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

            <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--border)]">
              <h3 className="text-sm font-semibold mb-3">⭐ Man of the Match</h3>
              {motm && <p className="text-sm text-[var(--sand)] font-semibold mb-2">{playerName(motm.player)}</p>}
              {!motm && <p className="text-xs text-[var(--subtle2)] mb-2">Nog niet gekozen</p>}
              <div className="flex flex-wrap gap-2">
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
          </div>
        )}
      </div>

      {showGoalModal && (
        <GoalModal
          players={selectedPlayers}
          onAddGoal={(pid) => { addGoal(pid); setShowGoalModal(false) }}
          onAddCorner={(tid, hid, isGoal) => { addCorner(tid, hid, isGoal); setShowGoalModal(false) }}
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

// --- Modals ---

function ModalWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-[var(--surface)] rounded-3xl w-full max-w-lg p-6 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose}><X size={20} className="text-[var(--subtle)]" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function PlayerGrid({ players, selectedId, onSelect, accent = 'sand' }: {
  players: Player[]
  selectedId: string
  onSelect: (id: string) => void
  accent?: 'sand' | 'olive'
}) {
  const activeCls = accent === 'sand' ? 'bg-[var(--sand)] text-black' : 'bg-[var(--olive)] text-white'
  return (
    <div className="grid grid-cols-2 gap-2">
      {players.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={`py-3 px-3 rounded-xl text-sm font-semibold text-left leading-tight transition-colors ${
            selectedId === p.id ? activeCls : 'bg-[var(--muted)] text-[var(--fg)]'
          }`}
        >
          {p.first_name}<br />
          <span className="font-black">{p.last_name}</span>
        </button>
      ))}
    </div>
  )
}

function GoalModal({ players, onAddGoal, onAddCorner, onClose }: {
  players: Player[]
  onAddGoal: (pid: string) => void
  onAddCorner: (tid: string, hid: string, isGoal: boolean) => void
  onClose: () => void
}) {
  const [scorerId, setScorerId] = useState('')
  const [isCorner, setIsCorner] = useState(false)
  const [takerId, setTakerId] = useState('')

  const canSave = scorerId && (!isCorner || takerId)

  function handleSave() {
    if (!scorerId) return
    if (isCorner && takerId) {
      onAddCorner(takerId, scorerId, true)
    } else if (!isCorner) {
      onAddGoal(scorerId)
    }
    // both paths call onClose via parent wrapper
  }

  return (
    <ModalWrapper title="⚽ Doelpunt" onClose={onClose}>
      {players.length === 0 ? (
        <p className="text-center text-[var(--subtle2)] py-4 text-sm">Geen spelers in selectie — voeg eerst spelers toe via Info</p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-[var(--subtle)] mb-2">Wie scoorde?</p>
            <PlayerGrid players={players} selectedId={scorerId} onSelect={setScorerId} accent="sand" />
          </div>

          {scorerId && (
            <button
              onClick={() => { setIsCorner((v) => !v); setTakerId('') }}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
                isCorner ? 'bg-[var(--olive)] text-white' : 'bg-[var(--muted)] text-[var(--subtle)]'
              }`}
            >
              🎯 {isCorner ? 'Corner goal ✓ — tik om uit te zetten' : 'Was dit een corner goal?'}
            </button>
          )}

          {isCorner && (
            <div>
              <p className="text-xs text-[var(--subtle)] mb-1">
                Wie nam de corner? <span className="text-red-400">*verplicht</span>
              </p>
              <PlayerGrid
                players={players.filter((p) => p.id !== scorerId)}
                selectedId={takerId}
                onSelect={setTakerId}
                accent="olive"
              />
            </div>
          )}

          <button
            disabled={!canSave}
            onClick={handleSave}
            className="w-full bg-[var(--sand)] text-black rounded-xl py-4 font-bold disabled:opacity-40"
          >
            {isCorner ? '⚽ Corner goal opslaan' : '⚽ Doelpunt opslaan'}
          </button>
        </div>
      )}
    </ModalWrapper>
  )
}

function CornerModal({ players, onAdd, onClose }: {
  players: Player[]
  onAdd: (tid: string, hid: string, isGoal: boolean) => void
  onClose: () => void
}) {
  const [takerId, setTakerId] = useState('')
  const [headerId, setHeaderId] = useState('')
  const [isGoal, setIsGoal] = useState(false)

  return (
    <ModalWrapper title="🎯 Corner" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-xs text-[var(--subtle)] mb-2">Nemer</p>
          <PlayerGrid players={players} selectedId={takerId} onSelect={setTakerId} accent="olive" />
        </div>
        <div>
          <p className="text-xs text-[var(--subtle)] mb-2">Kopballer</p>
          <PlayerGrid players={players} selectedId={headerId} onSelect={setHeaderId} accent="olive" />
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsGoal(false)}
            className={`flex-1 py-4 rounded-xl font-semibold text-sm transition-colors ${!isGoal ? 'bg-[var(--olive)] text-white' : 'bg-[var(--muted)] text-[var(--subtle)]'}`}
          >
            🎯 Geen goal
          </button>
          <button
            onClick={() => setIsGoal(true)}
            className={`flex-1 py-4 rounded-xl font-semibold text-sm transition-colors ${isGoal ? 'bg-[var(--sand)] text-black' : 'bg-[var(--muted)] text-[var(--subtle)]'}`}
          >
            ⚽ Goal!
          </button>
        </div>
        <button
          disabled={!takerId || !headerId}
          onClick={() => onAdd(takerId, headerId, isGoal)}
          className="w-full bg-[var(--sand)] text-black rounded-xl py-4 font-bold disabled:opacity-40"
        >
          Opslaan
        </button>
      </div>
    </ModalWrapper>
  )
}

function CardModal({ players, onAdd, onClose }: {
  players: Player[]
  onAdd: (pid: string, type: 'yellow' | 'red') => void
  onClose: () => void
}) {
  const [cardType, setCardType] = useState<'yellow' | 'red'>('yellow')

  return (
    <ModalWrapper title="Kaart" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-3">
          {(['yellow', 'red'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setCardType(t)}
              className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 bg-[var(--muted)] transition-all ${cardType === t ? 'ring-2 ring-[var(--sand)]' : ''}`}
            >
              <span className={`w-5 h-7 rounded-sm ${t === 'yellow' ? 'bg-yellow-400' : 'bg-red-500'}`} />
              <span className="text-sm font-semibold">{t === 'yellow' ? 'Geel' : 'Rood'}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--subtle)]">Wie krijgt de kaart?</p>
        {players.length === 0 ? (
          <p className="text-center text-[var(--subtle2)] py-4 text-sm">Geen spelers in selectie</p>
        ) : (
          <PlayerGrid players={players} selectedId="" onSelect={(pid) => onAdd(pid, cardType)} accent="sand" />
        )}
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

  return (
    <ModalWrapper title="Kleren toewijzen" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-xs text-[var(--subtle)] mb-2">Sluit spelers uit:</p>
          <div className="flex flex-wrap gap-2">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => setExcludeIds((prev) => prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id])}
                className={`text-xs px-3 py-1.5 rounded-lg ${excludeIds.includes(p.id) ? 'bg-red-900/40 text-red-400 line-through' : 'bg-[var(--muted)] text-[var(--fg)]'}`}
              >
                {p.first_name} {p.last_name}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => onPick(excludeIds)} className="w-full bg-[var(--sand)] text-black rounded-xl py-3 font-bold flex items-center justify-center gap-2">
          <Shuffle size={16} /> Willekeurig kiezen
        </button>
        <div className="border-t border-[var(--border)] pt-4">
          <p className="text-xs text-[var(--subtle)] mb-2">Of kies manueel:</p>
          <select value={manualId} onChange={(e) => setManualId(e.target.value)} className="w-full bg-[var(--muted)] rounded-xl px-4 py-3 text-[var(--fg)] focus:outline-none mb-3">
            <option value="">Kies speler</option>
            {allPlayers.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
          </select>
          <button disabled={!manualId} onClick={() => onManualPick(manualId)} className="w-full bg-[var(--muted)] rounded-xl py-3 font-semibold disabled:opacity-40">
            Bevestigen
          </button>
        </div>
      </div>
    </ModalWrapper>
  )
}

function PlayerModal({ allPlayers, selectedIds, onAdd, onClose }: {
  allPlayers: Player[]
  selectedIds: string[]
  onAdd: (pid: string) => void
  onClose: () => void
}) {
  const unselected = allPlayers.filter((p) => !selectedIds.includes(p.id))
  return (
    <ModalWrapper title="Speler toevoegen" onClose={onClose}>
      <div className="space-y-2">
        {unselected.map((p) => (
          <button key={p.id} onClick={() => onAdd(p.id)} className="w-full text-left px-4 py-3 bg-[var(--muted)] rounded-xl text-sm hover:bg-[var(--border)] transition-colors">
            {p.first_name} {p.last_name}
          </button>
        ))}
        {unselected.length === 0 && <p className="text-center text-[var(--subtle2)] py-4">Alle spelers geselecteerd</p>}
      </div>
    </ModalWrapper>
  )
}

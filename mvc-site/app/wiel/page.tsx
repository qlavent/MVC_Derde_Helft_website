'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, X, RotateCcw } from 'lucide-react'

const STORAGE_KEY = 'mvc-wiel-items'
const COLORS = ['#FF6B6B','#FF9F43','#FECA57','#48DBFB','#54A0FF','#5F27CD','#1DD1A1','#FF9FF3','#EE5A24','#0ABDE3','#10AC84','#EE5A24']

export default function WielPage() {
  const [items, setItems] = useState<string[]>([])
  const [newItem, setNewItem] = useState('')
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rotationRef = useRef(0)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) setItems(JSON.parse(saved))
    else setItems(['Taak 1', 'Taak 2', 'Taak 3'])
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    drawWheel(rotationRef.current)
  }, [items])

  const drawWheel = useCallback((rotation: number) => {
    const canvas = canvasRef.current
    if (!canvas || items.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const cx = canvas.width / 2
    const cy = canvas.height / 2
    const r = cx - 8
    const arc = (2 * Math.PI) / items.length

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    items.forEach((item, i) => {
      const angle = rotation + i * arc
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, angle, angle + arc)
      ctx.closePath()
      ctx.fillStyle = COLORS[i % COLORS.length]
      ctx.fill()
      ctx.strokeStyle = '#0a0a0a'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(angle + arc / 2)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#0a0a0a'
      ctx.font = 'bold 13px -apple-system, sans-serif'
      const maxLen = 14
      const label = item.length > maxLen ? item.slice(0, maxLen) + '…' : item
      ctx.fillText(label, r - 10, 5)
      ctx.restore()
    })

    // Center circle
    ctx.beginPath()
    ctx.arc(cx, cy, 18, 0, 2 * Math.PI)
    ctx.fillStyle = '#0a0a0a'
    ctx.fill()
  }, [items])

  useEffect(() => {
    drawWheel(rotationRef.current)
  }, [drawWheel])

  function addItem() {
    if (!newItem.trim() || items.length >= 16) return
    setItems([...items, newItem.trim()])
    setNewItem('')
    setResult(null)
  }

  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i))
    setResult(null)
  }

  async function spin() {
    if (items.length < 2 || spinning) return
    setSpinning(true)
    setResult(null)

    const extraSpins = 5 + Math.random() * 5
    const landingIndex = Math.floor(Math.random() * items.length)
    const arc = (2 * Math.PI) / items.length
    const targetRotation = rotationRef.current + extraSpins * 2 * Math.PI - landingIndex * arc + arc / 2 - Math.PI / 2

    const duration = 4000
    const start = performance.now()
    const startRotation = rotationRef.current

    function animate(now: number) {
      const elapsed = now - start
      const t = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - t, 4)
      const currentRotation = startRotation + (targetRotation - startRotation) * ease
      rotationRef.current = currentRotation
      drawWheel(currentRotation)

      if (t < 1) {
        requestAnimationFrame(animate)
      } else {
        setSpinning(false)
        setResult(items[landingIndex])
        // Confetti
        import('canvas-confetti').then(({ default: confetti }) => {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#C8B99A', '#6B7045', '#ffffff'] })
        })
      }
    }

    requestAnimationFrame(animate)
  }

  return (
    <div className="min-h-screen">
      <div className="px-4 pt-12 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden border flex-shrink-0" style={{ borderColor: 'var(--sand)' }}>
            <img src="/logo.jpg" alt="logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-black">Wiel</h1>
        </div>
        <p className="text-xs text-[var(--subtle)] mt-1">Draai het wiel voor een willekeurige taak</p>
      </div>

      {/* Wheel */}
      <div className="flex flex-col items-center px-4 mb-4">
        <div className="relative">
          {/* Pointer */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10 w-0 h-0" style={{ borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '20px solid var(--sand)' }} />
          <canvas
            ref={canvasRef}
            width={300}
            height={300}
            className="rounded-full"
          />
        </div>

        {/* Result */}
        {result && (
          <div className="mt-4 bg-[var(--surface)] border border-[var(--sand)] rounded-2xl px-6 py-4 text-center">
            <p className="text-xs text-[var(--subtle)] mb-1">Resultaat</p>
            <p className="text-lg font-black text-[var(--sand)]">{result}</p>
          </div>
        )}

        {/* Spin button */}
        <button
          onClick={spin}
          disabled={spinning || items.length < 2}
          className="mt-4 bg-[var(--sand)] text-[var(--sand-fg)] rounded-2xl px-8 py-4 font-black text-lg disabled:opacity-40 active:scale-95 transition-transform"
        >
          {spinning ? 'Draaien...' : '🎡 Draai!'}
        </button>
      </div>

      {/* Items */}
      <div className="px-4 pb-28">
        <div className="flex gap-2 mb-4">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder="Nieuw item..."
            className="flex-1 bg-[var(--surface)] rounded-xl px-4 py-3 text-sm text-[var(--fg)] placeholder-[var(--subtle)] border border-[var(--border)] focus:outline-none focus:border-[var(--sand)]"
          />
          <button onClick={addItem} disabled={!newItem.trim()} className="bg-[var(--sand)] text-[var(--sand-fg)] rounded-xl px-4 disabled:opacity-40">
            <Plus size={18} />
          </button>
        </div>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 bg-[var(--surface)] rounded-xl px-4 py-3 border border-[var(--border)]">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-sm flex-1">{item}</span>
              <button onClick={() => removeItem(i)} className="text-[var(--subtle2)] hover:text-red-400">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <button
            onClick={() => { setItems([]); setResult(null) }}
            className="mt-4 w-full text-xs text-[var(--subtle2)] flex items-center justify-center gap-1 py-3"
          >
            <RotateCcw size={12} /> Alles wissen
          </button>
        )}
      </div>
    </div>
  )
}

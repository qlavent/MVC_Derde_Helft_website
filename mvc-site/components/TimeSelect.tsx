'use client'

import Picker from 'react-mobile-picker'

const HOURS = Array.from({length:24}, (_,i) => String(i).padStart(2,'0'))
const MINUTES = ['00','05','10','15','20','25','30','35','40','45','50','55']

export default function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const h = value ? value.split(':')[0] : '08'
  const m = value ? value.split(':')[1] : '00'

  function stepHour(dir: 1 | -1) {
    const idx = Math.max(0, Math.min(23, parseInt(h) + dir))
    onChange(`${String(idx).padStart(2,'0')}:${m}`)
  }
  function stepMinute(dir: 1 | -1) {
    const idx = Math.max(0, Math.min(MINUTES.length - 1, MINUTES.indexOf(m) + dir))
    onChange(`${h}:${MINUTES[idx]}`)
  }

  const btnCls = "w-full flex items-center justify-center py-1 text-[var(--subtle)] hover:text-[var(--sand)] active:scale-95 transition-all text-lg leading-none select-none"

  return (
    <div className="bg-[var(--muted)] border border-[var(--border)] rounded-xl overflow-hidden" style={{width: 120}}>
      <div className="flex border-b border-[var(--border)]">
        <button type="button" onClick={() => stepHour(1)} className={`${btnCls} border-r border-[var(--border)]`}>▲</button>
        <button type="button" onClick={() => stepMinute(1)} className={btnCls}>▲</button>
      </div>
      <div className="flex items-center justify-center gap-0.5 py-1 border-b border-[var(--border)]">
        <span className="text-sm font-black text-[var(--sand)]">{h}</span>
        <span className="text-sm font-black text-[var(--sand)]">:</span>
        <span className="text-sm font-black text-[var(--sand)]">{m}</span>
      </div>
      <div className="relative">
        <Picker
          value={{ hour: h, minute: m }}
          onChange={(val) => onChange(`${val.hour}:${val.minute}`)}
          height={120}
          itemHeight={40}
          wheelMode="normal"
        >
          <Picker.Column name="hour">
            {HOURS.map(v => (
              <Picker.Item key={v} value={v}>
                {({ selected }: { selected: boolean }) => (
                  <span style={{ fontWeight: selected ? 800 : 400, fontSize: selected ? 17 : 14, color: selected ? 'var(--fg)' : 'var(--subtle)' }}>{v}</span>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>
          <Picker.Column name="minute">
            {MINUTES.map(v => (
              <Picker.Item key={v} value={v}>
                {({ selected }: { selected: boolean }) => (
                  <span style={{ fontWeight: selected ? 800 : 400, fontSize: selected ? 17 : 14, color: selected ? 'var(--fg)' : 'var(--subtle)' }}>{v}</span>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>
        </Picker>
        <div className="absolute left-0 right-0 pointer-events-none" style={{ top: 40, height: 40, borderTop: '2px solid var(--sand)', borderBottom: '2px solid var(--sand)' }} />
      </div>
      <div className="flex border-t border-[var(--border)]">
        <button type="button" onClick={() => stepHour(-1)} className={`${btnCls} border-r border-[var(--border)]`}>▼</button>
        <button type="button" onClick={() => stepMinute(-1)} className={btnCls}>▼</button>
      </div>
    </div>
  )
}

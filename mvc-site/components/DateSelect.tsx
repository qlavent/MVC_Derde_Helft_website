'use client'

import { forwardRef } from 'react'
import DatePicker from 'react-datepicker'
import { nl as nlLocale } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'

/**
 * Date field for the event forms. Was duplicated verbatim in the kalender page and the
 * event detail page, so both had the same phone problems.
 *
 * The trigger is a <button>, not an <input>. iOS Safari zooms in whenever a focused text
 * field has a font size under 16px and never zooms back out, which left the page slightly
 * enlarged after picking a date. A button is not a text-entry field, so it neither takes
 * that zoom nor raises the keyboard — and the font size stays 14px to match the form.
 *
 * withPortal: the calendar renders as a centred overlay at body level. Inside the
 * new-event modal (overflow-y-auto) a popper got clipped, and a centred sheet is easier
 * to hit on a phone.
 */

const DateTrigger = forwardRef<
  HTMLButtonElement,
  { value?: string; onClick?: () => void; placeholder?: string }
>(function DateTrigger({ value, onClick, placeholder }, ref) {
  return (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      className="w-full bg-[var(--muted)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-left focus:outline-none"
    >
      {value ? (
        <span className="text-[var(--fg)]">{value}</span>
      ) : (
        <span className="text-[var(--subtle)]">{placeholder ?? 'dd/mm/jjjj'}</span>
      )}
    </button>
  )
})

export default function DateSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const selected = value ? new Date(value + 'T12:00:00') : null
  return (
    <DatePicker
      selected={selected}
      onChange={(date: Date | null) => {
        if (date) {
          const y = date.getFullYear()
          const m = String(date.getMonth() + 1).padStart(2, '0')
          const d = String(date.getDate()).padStart(2, '0')
          onChange(`${y}-${m}-${d}`)
        } else {
          onChange('')
        }
      }}
      dateFormat="dd/MM/yyyy"
      locale={nlLocale}
      placeholderText="dd/mm/jjjj"
      withPortal
      wrapperClassName="flex-1"
      customInput={<DateTrigger />}
    />
  )
}

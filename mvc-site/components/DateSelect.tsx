'use client'

import DatePicker from 'react-datepicker'
import { nl as nlLocale } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'

/**
 * Date field for the event forms. Was duplicated verbatim in the kalender page and the
 * event detail page, so both had the same phone problems.
 *
 * inputMode="none" + readOnly on the input: tapping the field used to raise the keyboard
 * over the calendar, when the point is picking from the calendar. Both go on the input —
 * DatePicker's own readOnly prop would also stop the calendar opening.
 *
 * withPortal: renders the calendar as a centred overlay at body level instead of a popper.
 * Inside the new-event modal (which is overflow-y-auto) the popper got clipped, and on a
 * phone a centred sheet is easier to hit anyway.
 */
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
      // inputMode is not in react-datepicker's prop types, so the field is supplied
      // directly. DatePicker injects value and the click handler that opens the calendar.
      customInput={
        <input
          // readOnly lives on the input, not on DatePicker: DatePicker's own readOnly
          // prop also suppresses opening the calendar, which defeats the purpose.
          readOnly
          inputMode="none"
          className="flex-1 bg-[var(--muted)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-[var(--fg)] text-sm focus:outline-none w-full cursor-pointer"
        />
      }
    />
  )
}

import { formatJst, jstDateTime } from '../logic/day'

/** 日付と時刻を選ぶ欄(日本時間)。値は Date */
export function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string
  value: Date
  onChange: (d: Date) => void
}) {
  const date = formatJst(value, 'yyyy-MM-dd')
  const time = formatJst(value, 'HH:mm')
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-row">
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && onChange(jstDateTime(e.target.value, time))}
        />
        <input
          type="time"
          value={time}
          onChange={(e) => e.target.value && onChange(jstDateTime(date, e.target.value))}
        />
      </span>
    </label>
  )
}

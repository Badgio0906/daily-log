import { addDays, type Day } from '../logic/day'

export interface Period {
  mode: '1w' | '4w' | 'custom'
  from: Day
  to: Day
}

export function presetPeriod(mode: '1w' | '4w', today: Day): Period {
  return { mode, from: addDays(today, mode === '1w' ? -6 : -27), to: today }
}

/** 期間の切り替え(1週間・4週間・任意の期間) */
export function PeriodPicker({ value, today, onChange }: { value: Period; today: Day; onChange: (p: Period) => void }) {
  return (
    <div className="period">
      <div className="chips">
        <button className={`chip ${value.mode === '1w' ? 'on' : ''}`} onClick={() => onChange(presetPeriod('1w', today))}>
          1週間
        </button>
        <button className={`chip ${value.mode === '4w' ? 'on' : ''}`} onClick={() => onChange(presetPeriod('4w', today))}>
          4週間
        </button>
        <button
          className={`chip ${value.mode === 'custom' ? 'on' : ''}`}
          onClick={() => onChange({ ...value, mode: 'custom' })}
        >
          期間を選ぶ
        </button>
      </div>
      {value.mode === 'custom' && (
        <div className="field-row period-range">
          <input
            type="date"
            aria-label="はじめの日"
            value={value.from}
            max={value.to}
            onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
          />
          <span>〜</span>
          <input
            type="date"
            aria-label="おわりの日"
            value={value.to}
            min={value.from}
            onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
          />
        </div>
      )}
    </div>
  )
}

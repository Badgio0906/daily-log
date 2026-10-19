import { useEffect, useRef, useState } from 'react'
import type { ItemDef, RecordValue } from '../db/types'
import { formatValue } from '../logic/format'

/**
 * 項目の入力タイプに合わせた入力欄。
 * 値を消したとき(チェックを外す、選択をやめる、空にする)は undefined を渡す。
 */
export function ValueInput({
  item,
  value,
  onChange,
}: {
  item: ItemDef
  value: RecordValue | undefined
  onChange: (v: RecordValue | undefined) => void
}) {
  switch (item.inputType) {
    case 'check':
      return (
        <div className="chips">
          <button
            className={`chip ${value === true ? 'on' : ''}`}
            aria-pressed={value === true}
            onClick={() => onChange(value === true ? undefined : true)}
          >
            {value === true ? '✓ ' : ''}
            {item.options[0] ?? 'はい'}
          </button>
        </div>
      )
    case 'single':
      return (
        <div className="chips">
          {item.options.map((o) => (
            <button
              key={o}
              className={`chip ${value === o ? 'on' : ''}`}
              aria-pressed={value === o}
              onClick={() => onChange(value === o ? undefined : o)}
            >
              {o}
            </button>
          ))}
        </div>
      )
    case 'multi': {
      const list = Array.isArray(value) ? value : []
      return (
        <div className="chips">
          {item.options.map((o) => {
            const on = list.includes(o)
            return (
              <button
                key={o}
                className={`chip ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => {
                  const next = on ? list.filter((x) => x !== o) : [...list, o]
                  onChange(next.length ? item.options.filter((x) => next.includes(x)) : undefined)
                }}
              >
                {on ? '✓ ' : ''}
                {o}
              </button>
            )
          })}
        </div>
      )
    }
    case 'slider':
      return (
        <SliderInput
          item={item}
          value={typeof value === 'number' ? value : undefined}
          onCommit={(v) => onChange(v)}
        />
      )
    case 'number':
      return <TextLikeInput kind="number" value={value} onCommit={onChange} />
    case 'memo':
      return <TextLikeInput kind="memo" value={value} onCommit={onChange} />
  }
}

/** スライダー。指を離したときに onCommit を呼ぶ */
export function SliderInput({
  item,
  value,
  onCommit,
}: {
  item: ItemDef
  value: number | undefined
  onCommit: (v: number) => void
}) {
  const range = item.range ?? { min: 0, max: 10, step: 1 }
  const neutral = range.min < 0 && range.max > 0 ? 0 : range.min
  const [draft, setDraft] = useState<number>(value ?? neutral)
  const ref = useRef<HTMLInputElement>(null)
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit

  useEffect(() => {
    if (value !== undefined) setDraft(value)
  }, [value])

  // React の onChange は動かしている途中にも呼ばれるため、指を離したとき(change)だけ保存する
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = () => commitRef.current(Number(el.value))
    el.addEventListener('change', handler)
    return () => el.removeEventListener('change', handler)
  }, [])

  return (
    <div className="slider">
      <div className="slider-value">{formatValue(item, draft)}</div>
      <input
        ref={ref}
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        aria-label={item.name}
      />
      <div className="slider-scale">
        <span>{formatValue(item, range.min)}</span>
        {range.min < 0 && <span>0 ふつう</span>}
        <span>{formatValue(item, range.max)}</span>
      </div>
    </div>
  )
}

function TextLikeInput({
  kind,
  value,
  onCommit,
}: {
  kind: 'number' | 'memo'
  value: RecordValue | undefined
  onCommit: (v: RecordValue | undefined) => void
}) {
  const initial = value === undefined ? '' : String(value)
  const [draft, setDraft] = useState(initial)
  useEffect(() => setDraft(initial), [initial])

  const commit = () => {
    const t = draft.trim()
    if (t === initial.trim()) return
    if (!t) return onCommit(undefined)
    if (kind === 'number') {
      const n = Number(t)
      if (Number.isFinite(n)) onCommit(n)
      return
    }
    onCommit(t)
  }

  return (
    <input
      className="text-input"
      type={kind === 'number' ? 'number' : 'text'}
      inputMode={kind === 'number' ? 'decimal' : 'text'}
      maxLength={kind === 'memo' ? 100 : undefined}
      placeholder={kind === 'memo' ? 'ひとこと(書かなくても大丈夫です)' : ''}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

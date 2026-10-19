import { useState } from 'react'
import { addSleep, deleteSleep, updateSleep } from '../db/db'
import type { Sleep } from '../db/types'
import { formatMinutes } from '../logic/sleep'
import { DateTimeField } from './DateTimeField'
import { Sheet } from './Sheet'

/** 睡眠の追加・修正・削除 */
export function SleepEditSheet({
  sleep,
  defaultStart,
  defaultEnd,
  onClose,
}: {
  /** 修正するときの睡眠。無ければ追加 */
  sleep?: Sleep
  defaultStart?: Date
  defaultEnd?: Date
  onClose: () => void
}) {
  const [start, setStart] = useState(() => (sleep ? new Date(sleep.start) : (defaultStart ?? new Date())))
  const [hasEnd, setHasEnd] = useState(() => (sleep ? sleep.end !== null : true))
  const [end, setEnd] = useState(() =>
    sleep?.end ? new Date(sleep.end) : (defaultEnd ?? new Date(start.getTime() + 60 * 60_000)),
  )
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)
  const valid = !hasEnd || minutes > 0

  const save = async () => {
    if (!valid) return
    if (sleep) await updateSleep(sleep.id, start, hasEnd ? end : null)
    else await addSleep(start, hasEnd ? end : null)
    onClose()
  }

  const remove = async () => {
    if (!sleep) return
    if (!confirm('この睡眠の記録を削除しますか?')) return
    await deleteSleep(sleep.id)
    onClose()
  }

  return (
    <Sheet title={sleep ? '睡眠を直す' : '睡眠を追加'} onClose={onClose}>
      <DateTimeField label="寝た時刻" value={start} onChange={setStart} />
      {hasEnd ? (
        <DateTimeField label="起きた時刻" value={end} onChange={setEnd} />
      ) : (
        <p className="muted">まだ起きた時刻がありません。</p>
      )}
      {sleep && sleep.end === null && (
        <label className="check-row">
          <input type="checkbox" checked={hasEnd} onChange={(e) => setHasEnd(e.target.checked)} />
          起きた時刻を入れる
        </label>
      )}
      {hasEnd && (
        <p className={valid ? 'muted' : 'warn'}>
          {valid ? `長さ:${formatMinutes(minutes)}` : '起きた時刻は、寝た時刻より後にしてください'}
        </p>
      )}
      <div className="sheet-actions">
        <button className="btn-primary" disabled={!valid} onClick={save}>
          {sleep ? 'この内容にする' : '追加する'}
        </button>
        {sleep && (
          <button className="btn-danger" onClick={remove}>
            削除
          </button>
        )}
      </div>
    </Sheet>
  )
}

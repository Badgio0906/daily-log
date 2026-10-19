import { useState } from 'react'
import { addSleep, deleteSleep, updateSleep } from '../db/db'
import type { RecordMethod, Sleep } from '../db/types'
import { formatMinutes } from '../logic/sleep'
import { DateTimeField } from './DateTimeField'
import { Sheet } from './Sheet'

const MIN = 60_000

/** 睡眠の記録・修正・削除。眠った時刻と起きた時刻を選ぶ */
export function SleepEditSheet({
  sleep,
  defaultStart,
  defaultEnd,
  method = 'added',
  onClose,
}: {
  /** 修正するときの睡眠。無ければ新しく記録 */
  sleep?: Sleep
  defaultStart?: Date
  defaultEnd?: Date
  /** 新しく記録するときの記録方法(きょう画面からは「その場」、記録の一覧からは「後から追加」) */
  method?: RecordMethod
  onClose: () => void
}) {
  const [start, setStart] = useState(() => (sleep ? new Date(sleep.start) : (defaultStart ?? new Date())))
  // 前の版で起きた時刻が入っていない睡眠は、7時間後(今より後なら今)を初めの値にする
  const [end, setEnd] = useState(() =>
    sleep?.end
      ? new Date(sleep.end)
      : (defaultEnd ?? new Date(Math.min(Date.now(), start.getTime() + 7 * 60 * MIN))),
  )
  const minutes = Math.round((end.getTime() - start.getTime()) / MIN)
  const future = end.getTime() > Date.now() + MIN
  const valid = minutes > 0 && !future

  const save = async () => {
    if (!valid) return
    if (sleep) await updateSleep(sleep.id, start, end)
    else await addSleep(start, end, method)
    onClose()
  }

  const remove = async () => {
    if (!sleep) return
    if (!confirm('この睡眠の記録を削除しますか?')) return
    await deleteSleep(sleep.id)
    onClose()
  }

  return (
    <Sheet title={sleep ? '睡眠を修正' : '睡眠を記録'} onClose={onClose}>
      <DateTimeField label="眠った時刻" value={start} onChange={setStart} />
      <DateTimeField label="起きた時刻" value={end} onChange={setEnd} />
      <p className={valid ? 'muted' : 'warn'}>
        {minutes <= 0
          ? '起きた時刻は、眠った時刻より後にしてください'
          : future
            ? '起きた時刻が、今より後になっています'
            : `長さ:${formatMinutes(minutes)}`}
      </p>
      <div className="sheet-actions">
        <button className="btn-primary" disabled={!valid} onClick={save}>
          {sleep ? 'この内容にする' : '記録する'}
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

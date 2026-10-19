import type { CutoffChange } from '../db/types'
import { formatCutoff, formatJst, type Day } from '../logic/day'
import { cutoffChangesInRange } from '../logic/sleep'

/** 期間内に区切り時刻を変えていたら、その旨を添える */
export function CutoffNote({
  history,
  from,
  to,
  cutoffMinutes,
}: {
  history: CutoffChange[]
  from: Day
  to: Day
  cutoffMinutes: number
}) {
  const changes = cutoffChangesInRange(history, from, to, cutoffMinutes)
  return (
    <p className="muted small">
      1日の区切り:{formatCutoff(cutoffMinutes)}
      {changes.length > 0 && (
        <>
          <br />
          この期間に区切り時刻を変えています(
          {changes.map((c) => `${formatJst(c.at, 'M/d')}に${formatCutoff(c.minutes)}へ`).join('、')}
          )。グラフはすべて今の区切り時刻で並べています。
        </>
      )}
    </p>
  )
}

import { useMemo, useState } from 'react'
import { RecordEditSheet } from '../components/RecordEditSheet'
import { SleepEditSheet } from '../components/SleepEditSheet'
import { TIME_SLOT_LABEL, type LogRecord, type Sleep } from '../db/types'
import type { AppData } from '../hooks'
import { addDays, dayStart, formatDayLabel, formatJst, logicalDay, type Day } from '../logic/day'
import { formatValue } from '../logic/format'
import { formatMinutes, groupSleepsByDay, type DaySleep } from '../logic/sleep'

const PAGE_DAYS = 14
const HOUR = 60 * 60_000

type Editing =
  | { kind: 'sleep'; sleep?: Sleep; start?: Date; end?: Date }
  | { kind: 'record'; record?: LogRecord; at?: Date }
  | null

export function ListScreen({ data, now }: { data: AppData; now: Date }) {
  const cutoff = data.settings.cutoffMinutes
  const today = logicalDay(now, cutoff)
  const [days, setDays] = useState(PAGE_DAYS)
  const [editing, setEditing] = useState<Editing>(null)

  const sleepsByDay = useMemo(() => groupSleepsByDay(data.sleeps, cutoff, now), [data.sleeps, cutoff, now])
  const recordsByDay = useMemo(() => {
    const map = new Map<Day, LogRecord[]>()
    const order = new Map(data.items.map((i) => [i.id, i.order]))
    const sorted = [...data.records].sort(
      (a, b) => (order.get(a.itemId) ?? 999) - (order.get(b.itemId) ?? 999) || a.at.localeCompare(b.at),
    )
    for (const r of sorted) {
      const d = logicalDay(r.at, cutoff)
      map.set(d, [...(map.get(d) ?? []), r])
    }
    return map
  }, [data.records, data.items, cutoff])

  // いちばん古い記録の日まで、さかのぼって見られるようにする
  const oldest = useMemo(() => {
    const all = [...sleepsByDay.keys(), ...recordsByDay.keys()].sort()
    return all[0] ?? today
  }, [sleepsByDay, recordsByDay, today])

  const dayList: Day[] = []
  for (let i = 0; i < days; i++) dayList.push(addDays(today, -i))
  const hasMore = addDays(today, -(days - 1)) > oldest

  return (
    <div className="screen">
      <h1>記録</h1>
      <p className="muted small">日付をタップすると、その日の記録を足せます。記録をタップすると直せます。</p>

      {dayList.map((day) => (
        <DayCard
          key={day}
          day={day}
          data={data}
          sleeps={sleepsByDay.get(day) ?? []}
          records={recordsByDay.get(day) ?? []}
          onAddSleep={() => {
            const start = new Date(dayStart(day, cutoff).getTime() + 19 * HOUR)
            setEditing({ kind: 'sleep', start, end: new Date(start.getTime() + 7 * HOUR) })
          }}
          onAddRecord={() => setEditing({ kind: 'record', at: new Date(dayStart(day, cutoff).getTime() + 8 * HOUR) })}
          onEditSleep={(sleep) => setEditing({ kind: 'sleep', sleep })}
          onEditRecord={(record) => setEditing({ kind: 'record', record })}
        />
      ))}

      {hasMore && (
        <button className="btn-secondary btn-block" onClick={() => setDays(days + PAGE_DAYS)}>
          もっと前を見る
        </button>
      )}

      {editing?.kind === 'sleep' && (
        <SleepEditSheet
          sleep={editing.sleep}
          defaultStart={editing.start}
          defaultEnd={editing.end}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'record' && (
        <RecordEditSheet
          record={editing.record}
          items={data.items}
          defaultAt={editing.at}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function DayCard({
  day,
  data,
  sleeps,
  records,
  onAddSleep,
  onAddRecord,
  onEditSleep,
  onEditRecord,
}: {
  day: Day
  data: AppData
  sleeps: DaySleep[]
  records: LogRecord[]
  onAddSleep: () => void
  onAddRecord: () => void
  onEditSleep: (s: Sleep) => void
  onEditRecord: (r: LogRecord) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <section className="card day-card">
      <button className="day-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="day-label">{formatDayLabel(day)}</span>
        <span className="muted">{open ? '閉じる' : '＋ 足す'}</span>
      </button>
      {open && (
        <div className="day-actions">
          <button className="btn-secondary" onClick={onAddSleep}>
            睡眠を追加
          </button>
          <button className="btn-secondary" onClick={onAddRecord}>
            記録を追加
          </button>
        </div>
      )}
      {sleeps.length > 0 && (
        <ul className="rows">
          {sleeps.map((s) => (
            <li key={s.sleep.id}>
              <button className="row" onClick={() => onEditSleep(s.sleep)}>
                <span className={`dot c${Math.min(s.index, 4)}`} aria-hidden />
                <span className="row-main">
                  睡眠 {s.index}回目 {formatJst(s.sleep.start, 'H:mm')}〜
                  {s.sleep.end ? endLabel(s.sleep.start, s.sleep.end) : ''}
                </span>
                <span className="muted small">{s.ongoing ? '起きた時刻なし' : formatMinutes(s.minutes)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {records.length > 0 && (
        <ul className="rows">
          {records.map((r) => {
            const item = data.itemById.get(r.itemId)
            return (
              <li key={r.id}>
                <button className="row" onClick={() => onEditRecord(r)}>
                  <span className="row-time muted small">{formatJst(r.at, 'H:mm')}</span>
                  <span className="row-main">
                    {item?.name ?? '(項目なし)'}
                    {r.slot ? `(${TIME_SLOT_LABEL[r.slot]})` : ''}
                  </span>
                  <span className="row-value">{formatValue(item, r.value)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function endLabel(startIso: string, endIso: string): string {
  const sameDate = formatJst(startIso, 'yyyy-MM-dd') === formatJst(endIso, 'yyyy-MM-dd')
  return (sameDate ? '' : '翌') + formatJst(endIso, 'H:mm')
}

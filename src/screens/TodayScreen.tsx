import { useMemo, useRef, useState } from 'react'
import { DateTimeField } from '../components/DateTimeField'
import { Sheet } from '../components/Sheet'
import { SleepEditSheet } from '../components/SleepEditSheet'
import { SliderInput, ValueInput } from '../components/ValueInput'
import { changeTodayValue, clearTodayValue, endSleep, saveTodayValue, startSleep } from '../db/db'
import { ITEM_IDS } from '../db/seed'
import { TIME_SLOTS, TIME_SLOT_LABEL, type ItemDef, type LogRecord, type TimeSlot } from '../db/types'
import type { AppData } from '../hooks'
import { formatDayLabel, formatJst, logicalDay } from '../logic/day'
import { formatValue } from '../logic/format'
import { backupReminderDue, formatMinutes, groupSleepsByDay, needsWakeConfirm } from '../logic/sleep'

export function TodayScreen({ data, now, onGoExport }: { data: AppData; now: Date; onGoExport: () => void }) {
  const cutoff = data.settings.cutoffMinutes
  const today = logicalDay(now, cutoff)
  const todaySleeps = groupSleepsByDay(data.sleeps, cutoff, now).get(today) ?? []
  const open = data.sleeps.filter((s) => s.end === null).sort((a, b) => b.start.localeCompare(a.start))[0]
  const [wakeLater, setWakeLater] = useState(false)
  const [addingSleep, setAddingSleep] = useState(false)

  const todayRecords = useMemo(
    () => data.records.filter((r) => logicalDay(r.at, cutoff) === today).sort((a, b) => a.at.localeCompare(b.at)),
    [data.records, cutoff, today],
  )
  const items = data.items.filter((i) => i.visible && i.id !== ITEM_IDS.sleepCount)
  const sleepCountItem = data.itemById.get(ITEM_IDS.sleepCount)

  return (
    <div className="screen today">
      {open && (
        <div className="sleeping-banner" role="status">
          睡眠中({formatJst(open.start, 'H時m分')}から)
        </div>
      )}

      <h1 className="day-title">{formatDayLabel(today)}</h1>

      {backupReminderDue(data.settings.lastBackupAt, data.settings.createdAt, now) && (
        <p className="gentle-note">
          前のバックアップから2週間たちました。{' '}
          <button className="btn-link" onClick={onGoExport}>
            書き出し画面
          </button>
          から保存できます。
        </p>
      )}

      <section className="card">
        <h2>今日の睡眠</h2>
        {todaySleeps.length === 0 ? (
          <p className="muted">まだありません</p>
        ) : (
          <ul className="sleep-list">
            {todaySleeps.map((s) => (
              <li key={s.sleep.id}>
                <span className={`dot c${Math.min(s.index, 4)}`} aria-hidden />
                {s.index}回目 {formatJst(s.sleep.start, 'H:mm')}〜{s.ongoing ? '' : formatJst(s.sleep.end!, 'H:mm')}
                <span className="muted">({s.ongoing ? '睡眠中' : formatMinutes(s.minutes)})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {sleepCountItem && (
        <SleepCountCard
          item={sleepCountItem}
          records={todayRecords.filter((r) => r.itemId === sleepCountItem.id)}
          recordedCount={todaySleeps.length}
          cutoff={cutoff}
          onAddSleep={() => setAddingSleep(true)}
        />
      )}

      {items.map((item) =>
        item.inputType === 'slider' && item.multiplePerDay ? (
          <MultiSliderCard key={item.id} item={item} records={todayRecords.filter((r) => r.itemId === item.id)} cutoff={cutoff} />
        ) : (
          <ItemCard key={item.id} item={item} records={todayRecords.filter((r) => r.itemId === item.id)} cutoff={cutoff} />
        ),
      )}

      <div className="sleep-button-area">
        {open ? (
          <button className="sleep-button wake" onClick={() => endSleep(open.id, new Date(), 'live')}>
            起きた
          </button>
        ) : (
          <button className="sleep-button" onClick={() => startSleep()}>
            寝る
          </button>
        )}
      </div>

      {open && !wakeLater && needsWakeConfirm(open, now) && (
        <WakeConfirmSheet startIso={open.start} now={now} sleepId={open.id} onLater={() => setWakeLater(true)} />
      )}
      {addingSleep && (
        <SleepEditSheet
          defaultStart={new Date(now.getTime() - 60 * 60_000)}
          defaultEnd={now}
          onClose={() => setAddingSleep(false)}
        />
      )}
    </div>
  )
}

/** 「起きた」を押し忘れたときに、起きた時刻を補う */
function WakeConfirmSheet({
  startIso,
  sleepId,
  now,
  onLater,
}: {
  startIso: string
  sleepId: string
  now: Date
  onLater: () => void
}) {
  const startMs = Date.parse(startIso)
  const [end, setEnd] = useState(() => new Date(Math.min(now.getTime(), startMs + 8 * 60 * 60_000)))
  const valid = end.getTime() > startMs && end.getTime() <= Date.now() + 60_000
  return (
    <Sheet title="いつ起きましたか?">
      <p>
        {formatJst(startIso, 'M/d H:mm')} に「寝る」を押したままです。
        <br />
        起きた時刻を選んでください。
      </p>
      <DateTimeField label="起きた時刻" value={end} onChange={setEnd} />
      {!valid && <p className="warn">寝た時刻より後で、今より前の時刻にしてください</p>}
      <div className="sheet-actions">
        <button className="btn-primary" disabled={!valid} onClick={() => endSleep(sleepId, end, 'added')}>
          この時刻にする
        </button>
        <button className="btn-text" onClick={onLater}>
          あとで
        </button>
      </div>
    </Sheet>
  )
}

const COUNT_OPTIONS_TO_NUMBER: Record<string, number> = { '0回': 0, '1回': 1, '2回': 2, '3回以上': 3 }

/** 「今日は何回に分けて寝ましたか?」 */
function SleepCountCard({
  item,
  records,
  recordedCount,
  cutoff,
  onAddSleep,
}: {
  item: ItemDef
  records: LogRecord[]
  recordedCount: number
  cutoff: number
  onAddSleep: () => void
}) {
  const answer = records.at(-1)?.value as string | undefined
  const answered = answer !== undefined ? COUNT_OPTIONS_TO_NUMBER[answer] : undefined
  const matches =
    answered === undefined || (answered >= 3 ? recordedCount >= 3 : answered === recordedCount)

  return (
    <section className="card">
      <h2>今日は何回に分けて寝ましたか?</h2>
      <ValueInput
        item={item}
        value={answer}
        onChange={(v) => (v === undefined ? clearTodayValue(item.id, null, cutoff) : saveTodayValue(item, v, null, cutoff))}
      />
      {!matches && (
        <div className="gentle-note">
          記録は{recordedCount}回です。
          {answered !== undefined && answered > recordedCount ? (
            <button className="btn-secondary" onClick={onAddSleep}>
              睡眠を追加する
            </button>
          ) : (
            <span>直すときは「記録」の画面からどうぞ。</span>
          )}
        </div>
      )}
    </section>
  )
}

function ItemCard({ item, records, cutoff }: { item: ItemDef; records: LogRecord[]; cutoff: number }) {
  const slots: (TimeSlot | null)[] = item.useTimeSlots ? TIME_SLOTS : [null]
  return (
    <section className="card">
      <h2>{item.name}</h2>
      {slots.map((slot) => {
        const current = records.filter((r) => r.slot === slot).at(-1)
        return (
          <div key={slot ?? 'all'} className={slot ? 'slot-row' : ''}>
            {slot && <span className="slot-label">{TIME_SLOT_LABEL[slot]}</span>}
            <ValueInput
              item={item}
              value={current?.value}
              onChange={(v) =>
                v === undefined ? clearTodayValue(item.id, slot, cutoff) : saveTodayValue(item, v, slot, cutoff)
              }
            />
          </div>
        )
      })}
    </section>
  )
}

/** 気分のように1日に何回でも記録できるスライダー */
function MultiSliderCard({ item, records, cutoff }: { item: ItemDef; records: LogRecord[]; cutoff: number }) {
  // 動かし直してすぐ(5分以内)なら、さっきの記録を直す。時間がたっていれば新しく記録する
  const last = useRef<{ id: string; at: number } | null>(null)
  const commit = async (v: number) => {
    const l = last.current
    if (l && Date.now() - l.at < 5 * 60_000 && records.some((r) => r.id === l.id)) {
      await changeTodayValue(l.id, v)
      return
    }
    const rec = await saveTodayValue(item, v, null, cutoff)
    last.current = { id: rec.id, at: Date.now() }
  }
  return (
    <section className="card">
      <h2>{item.name}</h2>
      <SliderInput item={item} value={undefined} onCommit={commit} />
      {records.length > 0 && (
        <p className="muted small">
          今日の記録:
          {records.map((r) => `${formatJst(r.at, 'H:mm')} ${formatValue(item, r.value)}`).join(' / ')}
        </p>
      )}
    </section>
  )
}

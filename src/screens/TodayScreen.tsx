import { useMemo, useRef, useState } from 'react'
import { SleepEditSheet } from '../components/SleepEditSheet'
import { SliderInput, ValueInput } from '../components/ValueInput'
import { changeTodayValue, clearTodayValue, saveTodayValue } from '../db/db'
import { ITEM_IDS } from '../db/seed'
import { TIME_SLOTS, TIME_SLOT_LABEL, type ItemDef, type LogRecord, type Sleep, type TimeSlot } from '../db/types'
import type { AppData } from '../hooks'
import { addDays, dayStart, formatDayLabel, formatJst, logicalDay } from '../logic/day'
import { formatValue } from '../logic/format'
import { backupReminderDue, formatMinutes, groupSleepsByDay } from '../logic/sleep'

const MIN = 60_000

type SleepSheet = { kind: 'new' } | { kind: 'edit'; sleep: Sleep } | null

export function TodayScreen({ data, now, onGoExport }: { data: AppData; now: Date; onGoExport: () => void }) {
  const cutoff = data.settings.cutoffMinutes
  const today = logicalDay(now, cutoff)
  const byDay = groupSleepsByDay(data.sleeps, cutoff, now)
  const todaySleeps = byDay.get(today) ?? []
  // 朝に記録した夜の睡眠は、眠り始めた前の日の分になる。今日の区切り時刻より後に起きたものは、きょう画面にも出して直せるようにする
  const todayStartMs = dayStart(today, cutoff).getTime()
  const carriedSleeps = (byDay.get(addDays(today, -1)) ?? []).filter((s) => s.endMs > todayStartMs)
  const shownSleeps = [...carriedSleeps.map((s) => ({ ...s, carried: true })), ...todaySleeps.map((s) => ({ ...s, carried: false }))]
  const [sleepSheet, setSleepSheet] = useState<SleepSheet>(null)

  const todayRecords = useMemo(
    () => data.records.filter((r) => logicalDay(r.at, cutoff) === today).sort((a, b) => a.at.localeCompare(b.at)),
    [data.records, cutoff, today],
  )
  const items = data.items.filter((i) => i.visible && i.id !== ITEM_IDS.sleepCount)
  const sleepCountItem = data.itemById.get(ITEM_IDS.sleepCount)

  // 新しく記録するときの初めの値:起きた時刻は今(5分単位に切り捨て)、眠った時刻はその7時間前
  const defaultEnd = new Date(Math.floor(now.getTime() / (5 * MIN)) * 5 * MIN)
  const defaultStart = new Date(defaultEnd.getTime() - 7 * 60 * MIN)

  return (
    <div className="screen today">
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
        {shownSleeps.length === 0 ? (
          <p className="muted">まだありません</p>
        ) : (
          <ul className="sleep-list">
            {shownSleeps.map((s) => (
              <li key={s.sleep.id}>
                <span className={`dot c${Math.min(s.index, 4)}`} aria-hidden />
                <span className="sleep-text">
                  {s.carried && <span className="muted small">前の日の分 </span>}
                  {s.index}回目 {formatJst(s.sleep.start, 'H:mm')}〜{s.ongoing ? '' : formatJst(s.sleep.end!, 'H:mm')}
                  <span className="muted">({s.ongoing ? '起きた時刻なし' : formatMinutes(s.minutes)})</span>
                </span>
                <button className="btn-small" onClick={() => setSleepSheet({ kind: 'edit', sleep: s.sleep })}>
                  修正
                </button>
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
          onAddSleep={() => setSleepSheet({ kind: 'new' })}
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
        <button className="sleep-button" onClick={() => setSleepSheet({ kind: 'new' })}>
          睡眠を記録
        </button>
      </div>

      {sleepSheet?.kind === 'new' && (
        <SleepEditSheet
          defaultStart={defaultStart}
          defaultEnd={defaultEnd}
          method="live"
          onClose={() => setSleepSheet(null)}
        />
      )}
      {sleepSheet?.kind === 'edit' && <SleepEditSheet sleep={sleepSheet.sleep} onClose={() => setSleepSheet(null)} />}
    </div>
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

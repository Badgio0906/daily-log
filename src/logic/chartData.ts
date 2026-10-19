// グラフに渡すデータを作る(画面・印刷用レポートで共通)

import type { LogRecord, Sleep } from '../db/types'
import { dayStart, daysBetween, logicalDay, type Day } from './day'
import { groupSleepsByDay } from './sleep'

const HOUR = 60 * 60_000

export interface SleepSegment {
  day: Day
  dayIndex: number
  /** その日の何回目か */
  index: number
  start: string
  end: string | null
  minutes: number
  ongoing: boolean
  /** その日の区切り時刻からの時間(時) */
  fromH: number
  toH: number
}

export interface PeriodChartData {
  days: Day[]
  segments: SleepSegment[]
  /** 期間内のいちばん多い回数 */
  maxIndex: number
  /** 日ごとの睡眠の合計(分)。記録がない日は null */
  totalMinutes: (number | null)[]
  /** 気分の点。x は日の位置(0 = 1日目の区切り時刻、1 = 2日目の区切り時刻) */
  moodPoints: { x: number; value: number; at: string }[]
}

export function buildPeriodChartData(
  sleeps: Sleep[],
  records: LogRecord[],
  moodItemId: string,
  cutoffMinutes: number,
  from: Day,
  to: Day,
  now: Date,
): PeriodChartData {
  const days = daysBetween(from, to)
  const index = new Map(days.map((d, i) => [d, i]))
  const byDay = groupSleepsByDay(sleeps, cutoffMinutes, now)

  const segments: SleepSegment[] = []
  const totalMinutes: (number | null)[] = days.map(() => null)
  for (const [day, list] of byDay) {
    const i = index.get(day)
    if (i === undefined) continue
    const base = dayStart(day, cutoffMinutes).getTime()
    for (const s of list) {
      segments.push({
        day,
        dayIndex: i,
        index: s.index,
        start: s.sleep.start,
        end: s.sleep.end,
        minutes: s.minutes,
        ongoing: s.ongoing,
        fromH: (s.startMs - base) / HOUR,
        toH: (s.endMs - base) / HOUR,
      })
      totalMinutes[i] = (totalMinutes[i] ?? 0) + s.minutes
    }
  }

  const firstStart = dayStart(from, cutoffMinutes).getTime()
  const moodPoints = records
    .filter((r) => r.itemId === moodItemId && !r.deletedAt && typeof r.value === 'number')
    .filter((r) => index.has(logicalDay(r.at, cutoffMinutes)))
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((r) => ({ x: (Date.parse(r.at) - firstStart) / (24 * HOUR), value: r.value as number, at: r.at }))

  return {
    days,
    segments,
    maxIndex: segments.reduce((m, s) => Math.max(m, s.index), 0),
    totalMinutes,
    moodPoints,
  }
}

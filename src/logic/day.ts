// 1日の区切りの計算。
// 記録には日時だけを保存し、「何日の記録か」は表示するときに区切り時刻から計算する。
// 表示と日付の計算は、端末の設定によらず常に日本時間で行う。

import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'

export const TZ = 'Asia/Tokyo'
const MIN = 60_000

/** 'yyyy-MM-dd' 形式の日付 */
export type Day = string

/** ある日時が、区切り時刻で数えて何日に属するか */
export function logicalDay(isoOrDate: string | Date, cutoffMinutes: number): Day {
  const ms = toMs(isoOrDate) - cutoffMinutes * MIN
  return format(new TZDate(ms, TZ), 'yyyy-MM-dd')
}

/** その日の始まり(日本時間のその日の区切り時刻) */
export function dayStart(day: Day, cutoffMinutes: number): Date {
  const [y, m, d] = parseDay(day)
  return new Date(new TZDate(y, m - 1, d, 0, 0, 0, 0, TZ).getTime() + cutoffMinutes * MIN)
}

/** その日の終わり(次の日の始まり) */
export function dayEnd(day: Day, cutoffMinutes: number): Date {
  return dayStart(addDays(day, 1), cutoffMinutes)
}

export function addDays(day: Day, n: number): Day {
  const [y, m, d] = parseDay(day)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** from から to まで(両端を含む)の日付の並び */
export function daysBetween(from: Day, to: Day): Day[] {
  const out: Day[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/** 日本時間で書式を整える(date-fns の書式) */
export function formatJst(isoOrDate: string | Date, pattern: string): string {
  return format(new TZDate(toMs(isoOrDate), TZ), pattern)
}

/** 区切り時刻(分)を「4:00」の形に */
export function formatCutoff(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** 「10/19(日)」の形に */
export function formatDayLabel(day: Day): string {
  const [y, m, d] = parseDay(day)
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${m}/${d}(${WEEKDAYS[w]})`
}

/** 日本時間の「日付」と「時:分」から日時を作る(入力欄から日時を組み立てるときに使う) */
export function jstDateTime(date: Day, time: string): Date {
  const [y, m, d] = parseDay(date)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, 0, TZ).getTime())
}

function parseDay(day: Day): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number)
  return [y, m, d]
}

function toMs(v: string | Date): number {
  return typeof v === 'string' ? Date.parse(v) : v.getTime()
}

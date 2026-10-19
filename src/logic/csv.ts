// CSV の書き出し。Excel で文字化けしないよう UTF-8(BOM付き)、改行は CRLF。
// 日付は書き出し時点の区切り時刻で計算し、各行に区切り時刻を書く。

import type { ItemDef, LogRecord, RecordValue, Sleep } from '../db/types'
import { TIME_SLOT_LABEL } from '../db/types'
import { formatCutoff, formatJst, logicalDay, type Day } from './day'
import { groupSleepsByDay } from './sleep'

const BOM = '﻿'

type Cell = string | number | null

function escapeCell(v: Cell): string {
  if (v === null) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** 表計算ソフトで数式として扱われないよう、記号で始まる文字には ' を付ける */
function safeText(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
}

export function toCsv(rows: Cell[][]): string {
  return BOM + rows.map((r) => r.map(escapeCell).join(',')).join('\r\n') + '\r\n'
}

const dayCell = (d: Day) => d.replace(/-/g, '/')
const dateTime = (iso: string) => formatJst(iso, 'yyyy/MM/dd HH:mm')

/** 睡眠の CSV:1行1回の睡眠 */
export function sleepCsv(sleeps: Sleep[], cutoffMinutes: number, from: Day, to: Day, now: Date): string {
  const cutoff = formatCutoff(cutoffMinutes)
  const rows: Cell[][] = [['日付', '何回目', '開始', '終了', '長さ(分)', '日付の区切り時刻']]
  const byDay = [...groupSleepsByDay(sleeps, cutoffMinutes, now).entries()]
    .filter(([d]) => d >= from && d <= to)
    .sort(([a], [b]) => a.localeCompare(b))
  for (const [day, list] of byDay) {
    for (const s of list) {
      rows.push([
        dayCell(day),
        s.index,
        dateTime(s.sleep.start),
        s.sleep.end ? dateTime(s.sleep.end) : null,
        s.ongoing ? null : s.minutes,
        cutoff,
      ])
    }
  }
  return toCsv(rows)
}

/** CSV 用の値。数値はそのまま、文字は数式にならないようにする */
function csvValue(item: ItemDef | undefined, value: RecordValue): Cell {
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? (item?.options[0] ?? 'はい') : ''
  if (Array.isArray(value)) return safeText(value.join('・'))
  return safeText(value)
}

/** 項目の CSV:1行1件の記録 */
export function recordCsv(
  records: LogRecord[],
  items: Map<string, ItemDef>,
  cutoffMinutes: number,
  from: Day,
  to: Day,
  includeMemo: boolean,
): string {
  const cutoff = formatCutoff(cutoffMinutes)
  const rows: Cell[][] = [['日付', '時刻', '時間帯', '項目名', '値', '日付の区切り時刻']]
  const list = records
    .filter((r) => !r.deletedAt)
    .filter((r) => includeMemo || items.get(r.itemId)?.inputType !== 'memo')
    .map((r) => ({ r, day: logicalDay(r.at, cutoffMinutes) }))
    .filter(({ day }) => day >= from && day <= to)
    .sort((a, b) => a.r.at.localeCompare(b.r.at))
  for (const { r, day } of list) {
    const item = items.get(r.itemId)
    rows.push([
      dayCell(day),
      formatJst(r.at, 'HH:mm'),
      r.slot ? TIME_SLOT_LABEL[r.slot] : null,
      item?.name ?? '',
      csvValue(item, r.value),
      cutoff,
    ])
  }
  return toCsv(rows)
}

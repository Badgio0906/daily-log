// 睡眠の振り分け。睡眠は開始時刻が属する日に振り分け、区切り時刻をまたいでも2日に分けない。

import type { CutoffChange, Sleep } from '../db/types'
import { logicalDay, type Day } from './day'

/** バックアップの案内を出すまでの日数 */
export const BACKUP_REMINDER_DAYS = 14

const MIN = 60_000

export interface DaySleep {
  sleep: Sleep
  /** その日の何回目か(1から) */
  index: number
  startMs: number
  /** 起きた時刻がなければ今の時刻(前の版で「寝る」だけ押した記録) */
  endMs: number
  minutes: number
  /** 起きた時刻がない */
  ongoing: boolean
}

/** 削除されていない睡眠を、日ごと・開始順に並べ、何回目かを付ける */
export function groupSleepsByDay(sleeps: Sleep[], cutoffMinutes: number, now: Date): Map<Day, DaySleep[]> {
  const sorted = sleeps.filter((s) => !s.deletedAt).sort((a, b) => a.start.localeCompare(b.start))
  const map = new Map<Day, DaySleep[]>()
  for (const s of sorted) {
    const day = logicalDay(s.start, cutoffMinutes)
    const list = map.get(day) ?? []
    const startMs = Date.parse(s.start)
    const endMs = s.end ? Date.parse(s.end) : Math.max(startMs, now.getTime())
    list.push({
      sleep: s,
      index: list.length + 1,
      startMs,
      endMs,
      minutes: Math.round((endMs - startMs) / MIN),
      ongoing: s.end === null,
    })
    map.set(day, list)
  }
  return map
}

/** 期間(from〜to)の中で区切り時刻が変わった記録。最初の設定は変更に数えない */
export function cutoffChangesInRange(
  history: CutoffChange[],
  from: Day,
  to: Day,
  cutoffMinutes: number,
): CutoffChange[] {
  return history.slice(1).filter((h) => {
    const d = logicalDay(h.at, cutoffMinutes)
    return d >= from && d <= to
  })
}

/** 最後のバックアップ(なければ使い始め)から14日たったか */
export function backupReminderDue(lastBackupAt: string | null, firstUseAt: string, now: Date): boolean {
  const base = Date.parse(lastBackupAt ?? firstUseAt)
  return now.getTime() - base >= BACKUP_REMINDER_DAYS * 24 * 60 * MIN
}

/** 回ごとの色の番号(1回目=0 … 4回目以降=3) */
export function sleepColorIndex(index: number): number {
  return Math.min(Math.max(index, 1), 4) - 1
}

/** 分を「7時間30分」の形に */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}分`
  return m === 0 ? `${h}時間` : `${h}時間${m}分`
}

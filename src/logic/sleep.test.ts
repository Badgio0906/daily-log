import { describe, expect, test } from 'vitest'
import type { Sleep } from '../db/types'
import {
  backupReminderDue,
  cutoffChangesInRange,
  formatMinutes,
  groupSleepsByDay,
  needsWakeConfirm,
  sleepColorIndex,
} from './sleep'

function sleep(start: string, end: string | null, extra: Partial<Sleep> = {}): Sleep {
  return {
    id: start,
    createdAt: start,
    updatedAt: start,
    deletedAt: null,
    start,
    end,
    startMethod: 'live',
    endMethod: end ? 'live' : null,
    ...extra,
  }
}

const now = new Date('2026-10-20T00:00:00Z')

describe('睡眠の振り分け', () => {
  test('開始時刻の日に振り分け、区切りをまたいでも分割しない', () => {
    // 10/19 23:00 〜 10/20 7:00(日本時間)
    const map = groupSleepsByDay([sleep('2026-10-19T14:00:00Z', '2026-10-19T22:00:00Z')], 240, now)
    expect([...map.keys()]).toEqual(['2026-10-19'])
    expect(map.get('2026-10-19')![0].minutes).toBe(480)
  })

  test('同じ日の睡眠は開始順に1回目・2回目・3回目', () => {
    const map = groupSleepsByDay(
      [
        sleep('2026-10-19T05:00:00Z', '2026-10-19T06:00:00Z'), // 14:00
        sleep('2026-10-18T20:00:00Z', '2026-10-18T22:00:00Z'), // 5:00
        sleep('2026-10-19T14:00:00Z', '2026-10-19T18:00:00Z'), // 23:00
      ],
      240,
      now,
    )
    const day = map.get('2026-10-19')!
    expect(day.map((d) => d.index)).toEqual([1, 2, 3])
    expect(day.map((d) => d.sleep.start)).toEqual([
      '2026-10-18T20:00:00Z',
      '2026-10-19T05:00:00Z',
      '2026-10-19T14:00:00Z',
    ])
  })

  test('区切り時刻を変えると振り分けが変わり、戻すと元に戻る', () => {
    const sleeps = [
      sleep('2026-10-18T14:00:00Z', '2026-10-18T20:00:00Z'), // 10/18 23:00
      sleep('2026-10-18T21:00:00Z', '2026-10-18T22:00:00Z'), // 10/19 6:00
    ]
    const at4 = groupSleepsByDay(sleeps, 240, now)
    expect(at4.get('2026-10-18')).toHaveLength(1)
    expect(at4.get('2026-10-19')).toHaveLength(1)

    const at8 = groupSleepsByDay(sleeps, 480, now)
    expect(at8.get('2026-10-18')!.map((d) => d.index)).toEqual([1, 2])
    expect(at8.get('2026-10-19')).toBeUndefined()

    const back = groupSleepsByDay(sleeps, 240, now)
    expect([...back.entries()].map(([d, l]) => [d, l.length])).toEqual([...at4.entries()].map(([d, l]) => [d, l.length]))
  })

  test('削除した睡眠は数えない', () => {
    const map = groupSleepsByDay(
      [
        sleep('2026-10-18T20:00:00Z', '2026-10-18T22:00:00Z', { deletedAt: '2026-10-19T00:00:00Z' }),
        sleep('2026-10-19T05:00:00Z', '2026-10-19T06:00:00Z'),
      ],
      240,
      now,
    )
    expect(map.get('2026-10-19')!.map((d) => d.index)).toEqual([1])
  })

  test('終わっていない睡眠は今の時刻までの長さで、未終了の印が付く', () => {
    const map = groupSleepsByDay([sleep('2026-10-19T22:00:00Z', null)], 240, now)
    const d = map.get('2026-10-20')![0]
    expect(d.ongoing).toBe(true)
    expect(d.minutes).toBe(120)
  })
})

describe('押し忘れの判定', () => {
  test('「寝る」から20時間たったら聞く', () => {
    const open = sleep('2026-10-19T04:00:00Z', null)
    expect(needsWakeConfirm(open, new Date('2026-10-19T23:59:00Z'))).toBe(false)
    expect(needsWakeConfirm(open, new Date('2026-10-20T00:00:00Z'))).toBe(true)
    expect(needsWakeConfirm(undefined, now)).toBe(false)
  })
})

describe('区切り時刻の変更の注記', () => {
  const history = [
    { at: '2026-10-01T00:00:00Z', minutes: 240 },
    { at: '2026-10-10T03:00:00Z', minutes: 480 },
  ]
  test('期間内の変更だけを返し、最初の設定は数えない', () => {
    expect(cutoffChangesInRange(history, '2026-10-01', '2026-10-07', 480)).toHaveLength(0)
    expect(cutoffChangesInRange(history, '2026-10-08', '2026-10-14', 480)).toHaveLength(1)
  })
})

describe('その他', () => {
  test('バックアップから14日たったら案内', () => {
    expect(backupReminderDue(null, '2026-10-01T00:00:00Z', new Date('2026-10-14T23:00:00Z'))).toBe(false)
    expect(backupReminderDue(null, '2026-10-01T00:00:00Z', new Date('2026-10-15T00:00:00Z'))).toBe(true)
    expect(backupReminderDue('2026-10-10T00:00:00Z', '2026-10-01T00:00:00Z', new Date('2026-10-15T00:00:00Z'))).toBe(false)
  })

  test('回ごとの色は4色で、4回目以降は同じ色', () => {
    expect([1, 2, 3, 4, 5, 9].map(sleepColorIndex)).toEqual([0, 1, 2, 3, 3, 3])
  })

  test('長さの表示', () => {
    expect(formatMinutes(450)).toBe('7時間30分')
    expect(formatMinutes(45)).toBe('45分')
    expect(formatMinutes(120)).toBe('2時間')
  })
})

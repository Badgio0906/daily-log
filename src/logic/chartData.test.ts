import { describe, expect, test } from 'vitest'
import type { LogRecord, Sleep } from '../db/types'
import { buildPeriodChartData } from './chartData'

const base = { createdAt: '', updatedAt: '', deletedAt: null }
const sl = (id: string, start: string, end: string | null): Sleep => ({
  ...base,
  id,
  start,
  end,
  startMethod: 'live',
  endMethod: end ? 'live' : null,
})
const mood = (id: string, at: string, value: number, deletedAt: string | null = null): LogRecord => ({
  ...base,
  deletedAt,
  id,
  itemId: 'mood',
  at,
  value,
  slot: null,
  method: 'live',
})

describe('グラフのデータ', () => {
  const sleeps = [
    sl('a', '2026-10-18T14:00:00Z', '2026-10-18T21:00:00Z'), // 10/18 23:00〜10/19 6:00
    sl('b', '2026-10-19T05:00:00Z', '2026-10-19T06:00:00Z'), // 10/19 14:00〜15:00
    sl('c', '2026-10-19T13:00:00Z', null), // 10/19 22:00〜(睡眠中)
  ]
  const now = new Date('2026-10-19T15:00:00Z')

  test('日ごとの回数・合計・区切り時刻からの位置', () => {
    const d = buildPeriodChartData(sleeps, [], 'mood', 240, '2026-10-17', '2026-10-19', now)
    expect(d.days).toEqual(['2026-10-17', '2026-10-18', '2026-10-19'])
    expect(d.totalMinutes).toEqual([null, 420, 60 + 120])
    expect(d.maxIndex).toBe(2)
    const a = d.segments.find((s) => s.start === '2026-10-18T14:00:00Z')!
    expect(a.fromH).toBe(19) // 4:00 から 19時間後 = 23:00
    expect(a.toH).toBe(26) // 区切りをまたいでも分割しない
    const c = d.segments.find((s) => s.ongoing)!
    expect(c.index).toBe(2)
  })

  test('期間の外の睡眠は入れない', () => {
    const d = buildPeriodChartData(sleeps, [], 'mood', 240, '2026-10-19', '2026-10-19', now)
    expect(d.segments.map((s) => s.day)).toEqual(['2026-10-19', '2026-10-19'])
  })

  test('気分は全部の点を時刻の位置に置く(削除したものは除く)', () => {
    const recs = [
      mood('m1', '2026-10-18T19:00:00Z', 1), // 10/19 4:00 → x = 1
      mood('m2', '2026-10-19T07:00:00Z', -2), // 10/19 16:00 → x = 1.5
      mood('m3', '2026-10-19T08:00:00Z', 3, '2026-10-19T09:00:00Z'),
    ]
    const d = buildPeriodChartData([], recs, 'mood', 240, '2026-10-18', '2026-10-19', now)
    expect(d.moodPoints.map((p) => [p.x, p.value])).toEqual([
      [1, 1],
      [1.5, -2],
    ])
  })
})

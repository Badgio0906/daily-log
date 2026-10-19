import { describe, expect, test } from 'vitest'
import {
  addDays,
  dayEnd,
  dayStart,
  daysBetween,
  formatCutoff,
  formatDayLabel,
  formatJst,
  jstDateTime,
  logicalDay,
} from './day'

// 日本時間 = UTC + 9時間
describe('1日の区切りの計算', () => {
  test('区切り 4:00:日本時間 3:59 は前の日、4:00 はその日', () => {
    expect(logicalDay('2026-10-18T18:59:00Z', 240)).toBe('2026-10-18') // 10/19 3:59
    expect(logicalDay('2026-10-18T19:00:00Z', 240)).toBe('2026-10-19') // 10/19 4:00
  })

  test('区切り 0:00 なら日本時間の暦どおり', () => {
    expect(logicalDay('2026-10-18T14:59:00Z', 0)).toBe('2026-10-18') // 10/18 23:59
    expect(logicalDay('2026-10-18T15:00:00Z', 0)).toBe('2026-10-19') // 10/19 0:00
  })

  test('区切りを 8:00 に変えると並び直り、4:00 に戻すと元に戻る', () => {
    const at = '2026-10-18T21:00:00Z' // 10/19 6:00
    expect(logicalDay(at, 240)).toBe('2026-10-19')
    expect(logicalDay(at, 480)).toBe('2026-10-18')
    expect(logicalDay(at, 240)).toBe('2026-10-19')
  })

  test('15分単位の区切りも扱える', () => {
    expect(logicalDay('2026-10-18T19:14:00Z', 255)).toBe('2026-10-18') // 4:14
    expect(logicalDay('2026-10-18T19:15:00Z', 255)).toBe('2026-10-19') // 4:15
  })

  test('端末の時間帯ではなく日本時間で計算する(UTC の日付と食い違う時刻)', () => {
    expect(logicalDay('2026-10-18T16:00:00Z', 0)).toBe('2026-10-19') // UTC では 10/18
  })

  test('月末・年末をまたぐ', () => {
    expect(logicalDay('2026-12-31T18:00:00Z', 240)).toBe('2026-12-31') // 1/1 3:00
    expect(logicalDay('2026-12-31T19:00:00Z', 240)).toBe('2027-01-01') // 1/1 4:00
  })

  test('その日の始まりと終わり', () => {
    expect(dayStart('2026-10-19', 240).toISOString()).toBe('2026-10-18T19:00:00.000Z')
    expect(dayEnd('2026-10-19', 240).toISOString()).toBe('2026-10-19T19:00:00.000Z')
  })

  test('日付の足し算と並び', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  })

  test('表示用の書式', () => {
    expect(formatJst('2026-10-18T21:05:00Z', 'H:mm')).toBe('6:05')
    expect(formatCutoff(240)).toBe('4:00')
    expect(formatCutoff(495)).toBe('8:15')
    expect(formatDayLabel('2026-10-19')).toBe('10/19(月)')
    expect(jstDateTime('2026-10-19', '06:30').toISOString()).toBe('2026-10-18T21:30:00.000Z')
  })
})

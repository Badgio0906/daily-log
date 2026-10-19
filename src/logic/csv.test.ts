import { describe, expect, test } from 'vitest'
import { buildSeedItem, ITEM_IDS, SEED_ITEMS } from '../db/seed'
import type { LogRecord, RecordValue, Sleep, TimeSlot } from '../db/types'
import { recordCsv, sleepCsv, toCsv } from './csv'

const base = { createdAt: '', updatedAt: '', deletedAt: null }
const sl = (start: string, end: string | null): Sleep => ({
  ...base,
  id: start,
  start,
  end,
  startMethod: 'live',
  endMethod: end ? 'live' : null,
})
const rec = (itemId: string, at: string, value: RecordValue, slot: TimeSlot | null = null): LogRecord => ({
  ...base,
  id: at + itemId,
  itemId,
  at,
  value,
  slot,
  method: 'live',
})
const items = new Map(SEED_ITEMS.map((s) => [s.id, buildSeedItem(s, '')]))
const lines = (csv: string) => csv.slice(1).split('\r\n').filter(Boolean)

describe('CSV の基本', () => {
  test('BOM付き・CRLF・カンマや引用符を含む値を囲む', () => {
    const csv = toCsv([
      ['a', 'b,c'],
      ['say "hi"', null],
    ])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toBe('﻿a,"b,c"\r\n"say ""hi""",\r\n')
  })
})

describe('睡眠の CSV', () => {
  const now = new Date('2026-10-20T00:00:00Z')
  const sleeps = [
    sl('2026-10-18T14:00:00Z', '2026-10-18T21:30:00Z'), // 10/18 23:00〜10/19 6:30
    sl('2026-10-19T05:00:00Z', '2026-10-19T06:00:00Z'), // 10/19 14:00〜15:00
    sl('2026-10-19T21:00:00Z', null), // 10/20 6:00〜 睡眠中
  ]

  test('1行1回、区切り時刻で日付を計算し、区切り時刻を書く', () => {
    expect(lines(sleepCsv(sleeps, 240, '2026-10-18', '2026-10-20', now))).toEqual([
      '日付,何回目,開始,終了,長さ(分),日付の区切り時刻',
      '2026/10/18,1,2026/10/18 23:00,2026/10/19 06:30,450,4:00',
      '2026/10/19,1,2026/10/19 14:00,2026/10/19 15:00,60,4:00',
      '2026/10/20,1,2026/10/20 06:00,,,4:00',
    ])
  })

  test('区切り時刻を 8:00 にすると日付と何回目が変わる', () => {
    expect(lines(sleepCsv(sleeps, 480, '2026-10-18', '2026-10-20', now)).slice(1)).toEqual([
      '2026/10/18,1,2026/10/18 23:00,2026/10/19 06:30,450,8:00',
      '2026/10/19,1,2026/10/19 14:00,2026/10/19 15:00,60,8:00',
      '2026/10/19,2,2026/10/20 06:00,,,8:00',
    ])
  })

  test('期間の外は書き出さない', () => {
    expect(lines(sleepCsv(sleeps, 240, '2026-10-19', '2026-10-19', now))).toHaveLength(2)
  })
})

describe('項目の CSV', () => {
  const records = [
    rec(ITEM_IDS.activity, '2026-10-18T23:00:00Z', 'ふつう', 'morning'),
    rec(ITEM_IDS.mood, '2026-10-19T01:00:00Z', -2),
    rec(ITEM_IDS.medicine, '2026-10-19T02:00:00Z', true),
    rec(ITEM_IDS.moodExtra, '2026-10-19T03:00:00Z', ['イライラが強い', '考えが次々浮かぶ']),
    rec(ITEM_IDS.memo, '2026-10-19T04:00:00Z', '=つかれた, 少し'),
    { ...rec(ITEM_IDS.outing, '2026-10-19T05:00:00Z', true), deletedAt: '2026-10-19T06:00:00Z' },
  ]

  test('1行1件。一言メモは初期では含めない。削除した記録は出さない', () => {
    expect(lines(recordCsv(records, items, 240, '2026-10-19', '2026-10-19', false))).toEqual([
      '日付,時刻,時間帯,項目名,値,日付の区切り時刻',
      '2026/10/19,08:00,朝,活動量,ふつう,4:00',
      '2026/10/19,10:00,,気分,-2,4:00',
      '2026/10/19,11:00,,服薬,服薬した,4:00',
      '2026/10/19,12:00,,気分の補足,イライラが強い・考えが次々浮かぶ,4:00',
    ])
  })

  test('一言メモを含める場合は、数式にならないようにして囲む', () => {
    const out = lines(recordCsv(records, items, 240, '2026-10-19', '2026-10-19', true))
    expect(out.at(-1)).toBe(`2026/10/19,13:00,,一言メモ,"'=つかれた, 少し",4:00`)
  })
})

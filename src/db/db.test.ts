import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'vitest'
import {
  addSleep,
  alive,
  db,
  deleteSleep,
  endSleep,
  ensureInitialized,
  exportAll,
  getOpenSleep,
  getSettings,
  restoreAll,
  saveTodayValue,
  setCutoff,
  setItemVisible,
  startSleep,
  updateSleep,
} from './db'
import { SCHEMA_VERSION } from './migrations'
import { ITEM_IDS, SEED_ITEMS } from './seed'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await ensureInitialized(new Date('2026-10-01T00:00:00Z'))
})

describe('初期化', () => {
  test('初期の項目が9件登録され、何度起動しても増えない', async () => {
    await ensureInitialized()
    await ensureInitialized()
    expect(await db.itemDefs.count()).toBe(SEED_ITEMS.length)
    expect(await db.itemDefHistory.count()).toBe(SEED_ITEMS.length)
  })

  test('区切り時刻の初期値は 4:00、保存形式のバージョンを持つ', async () => {
    const s = await getSettings()
    expect(s.cutoffMinutes).toBe(240)
    expect(s.schemaVersion).toBe(SCHEMA_VERSION)
    expect(s.cutoffHistory).toHaveLength(1)
  })
})

describe('睡眠', () => {
  test('寝る→起きたを3回押すと3回分が残る', async () => {
    for (const [s, e] of [
      ['2026-10-02T13:00:00Z', '2026-10-02T20:00:00Z'],
      ['2026-10-03T03:00:00Z', '2026-10-03T04:00:00Z'],
      ['2026-10-03T08:00:00Z', '2026-10-03T08:30:00Z'],
    ]) {
      const sl = await startSleep(new Date(s))
      await endSleep(sl.id, new Date(e), 'live')
    }
    const all = alive(await db.sleeps.toArray())
    expect(all).toHaveLength(3)
    expect(all.every((s) => s.end && s.startMethod === 'live' && s.endMethod === 'live')).toBe(true)
  })

  test('睡眠中にもう一度「寝る」を押しても二重にならない', async () => {
    const a = await startSleep(new Date('2026-10-02T13:00:00Z'))
    const b = await startSleep(new Date('2026-10-02T14:00:00Z'))
    expect(b.id).toBe(a.id)
    expect((await getOpenSleep())?.id).toBe(a.id)
  })

  test('後から追加・修正・削除。削除しても実際には消えない', async () => {
    const s = await addSleep(new Date('2026-10-02T13:00:00Z'), new Date('2026-10-02T20:00:00Z'))
    expect(s.startMethod).toBe('added')
    await updateSleep(s.id, new Date('2026-10-02T13:00:00Z'), new Date('2026-10-02T21:00:00Z'))
    const edited = await db.sleeps.get(s.id)
    expect(edited?.startMethod).toBe('added')
    expect(edited?.endMethod).toBe('edited')
    await deleteSleep(s.id)
    expect(await db.sleeps.count()).toBe(1)
    expect(alive(await db.sleeps.toArray())).toHaveLength(0)
  })
})

describe('記録', () => {
  test('1日1回の項目は同じ日なら置き換え、気分は何回でも足す', async () => {
    const item = (await db.itemDefs.get(ITEM_IDS.outing))!
    const mood = (await db.itemDefs.get(ITEM_IDS.mood))!
    await saveTodayValue(item, true, null, 240, new Date('2026-10-02T01:00:00Z'))
    await saveTodayValue(item, true, null, 240, new Date('2026-10-02T05:00:00Z'))
    await saveTodayValue(mood, 1, null, 240, new Date('2026-10-02T01:00:00Z'))
    await saveTodayValue(mood, -1, null, 240, new Date('2026-10-02T05:00:00Z'))
    const recs = alive(await db.records.toArray())
    expect(recs.filter((r) => r.itemId === item.id)).toHaveLength(1)
    expect(recs.filter((r) => r.itemId === mood.id)).toHaveLength(2)
  })

  test('時間帯が違えば別の記録になる', async () => {
    const meal = (await db.itemDefs.get(ITEM_IDS.meal))!
    await saveTodayValue(meal, true, 'morning', 240, new Date('2026-10-02T00:00:00Z'))
    await saveTodayValue(meal, true, 'night', 240, new Date('2026-10-02T10:00:00Z'))
    expect(alive(await db.records.toArray())).toHaveLength(2)
  })
})

describe('項目と設定', () => {
  test('中心項目は非表示にできず、任意項目は非表示と履歴が残る', async () => {
    await setItemVisible(ITEM_IDS.mood, false)
    await setItemVisible(ITEM_IDS.outing, false)
    expect((await db.itemDefs.get(ITEM_IDS.mood))?.visible).toBe(true)
    expect((await db.itemDefs.get(ITEM_IDS.outing))?.visible).toBe(false)
    const hist = await db.itemDefHistory.where('itemId').equals(ITEM_IDS.outing).sortBy('at')
    expect(hist.map((h) => h.change)).toEqual(['added', 'hidden'])
  })

  test('区切り時刻を変えると履歴が残る', async () => {
    await setCutoff(480, new Date('2026-10-05T00:00:00Z'))
    const s = await getSettings()
    expect(s.cutoffMinutes).toBe(480)
    expect(s.cutoffHistory.map((h) => h.minutes)).toEqual([240, 480])
  })
})

describe('バックアップと復元', () => {
  test('書き出して、消してから復元すると元に戻る', async () => {
    const s = await startSleep(new Date('2026-10-02T13:00:00Z'))
    await endSleep(s.id, new Date('2026-10-02T20:00:00Z'), 'live')
    await saveTodayValue((await db.itemDefs.get(ITEM_IDS.mood))!, 2, null, 240, new Date('2026-10-02T01:00:00Z'))
    await setCutoff(300)
    const backup = JSON.parse(JSON.stringify(await exportAll()))

    await db.delete()
    await db.open()
    await ensureInitialized()
    expect(await db.sleeps.count()).toBe(0)

    await restoreAll(backup)
    expect(await db.sleeps.count()).toBe(1)
    expect(await db.records.count()).toBe(1)
    expect((await getSettings()).cutoffMinutes).toBe(300)
    expect(await db.itemDefs.count()).toBe(SEED_ITEMS.length)
  })

  test('ほかのアプリのファイルは復元しない', async () => {
    await expect(restoreAll({ foo: 1 })).rejects.toThrow()
  })
})

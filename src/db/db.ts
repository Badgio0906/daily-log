// 端末内の保存先(IndexedDB を Dexie で扱う)と、読み書きの操作。

import Dexie, { type Table } from 'dexie'
import { MIGRATIONS, SCHEMA_VERSION, STORES, TABLES, migrateBackup } from './migrations'
import { SEED_ITEMS, buildSeedItem } from './seed'
import type {
  BackupData,
  ItemDef,
  ItemDefHistory,
  ItemChange,
  LogRecord,
  RecordMethod,
  RecordValue,
  Settings,
  Sleep,
  TimeSlot,
} from './types'
import { logicalDay } from '../logic/day'

export const DEFAULT_CUTOFF_MINUTES = 4 * 60

export class AppDB extends Dexie {
  itemDefs!: Table<ItemDef, string>
  itemDefHistory!: Table<ItemDefHistory, string>
  sleeps!: Table<Sleep, string>
  records!: Table<LogRecord, string>
  settings!: Table<Settings, string>

  constructor(name = 'daily-log') {
    super(name)
    for (let v = 1; v <= SCHEMA_VERSION; v++) {
      const stores = STORES[v] ?? STORES[v - 1]
      const version = this.version(v).stores(stores)
      const step = MIGRATIONS[v]
      if (v > 1 && step) {
        version.upgrade(async (tx) => {
          for (const t of TABLES) {
            const fn = step[t]
            if (!fn) continue
            await tx
              .table(t)
              .toCollection()
              .modify((row: Record<string, unknown>, ref: { value: unknown }) => {
                ref.value = fn({ ...row })
              })
          }
        })
      }
    }
  }
}

export const db = new AppDB()

const iso = (d: Date) => d.toISOString()
const uuid = () => crypto.randomUUID()

function newRow(now: Date) {
  const t = iso(now)
  return { id: uuid(), createdAt: t, updatedAt: t, deletedAt: null }
}

export const alive = <T extends { deletedAt: string | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt)

// ---- 初期化 ----

/** 設定と初期の項目定義を、無ければ登録する */
export async function ensureInitialized(now = new Date()): Promise<void> {
  await db.transaction('rw', db.settings, db.itemDefs, db.itemDefHistory, async () => {
    const settings = await db.settings.get('app')
    if (!settings) {
      await db.settings.put({
        ...newRow(now),
        key: 'app',
        cutoffMinutes: DEFAULT_CUTOFF_MINUTES,
        cutoffHistory: [{ at: iso(now), minutes: DEFAULT_CUTOFF_MINUTES }],
        lastBackupAt: null,
        schemaVersion: SCHEMA_VERSION,
      })
    }
    for (const seed of SEED_ITEMS) {
      const existing = await db.itemDefs.get(seed.id)
      if (existing) continue
      await db.itemDefs.put(buildSeedItem(seed, iso(now)))
      await addItemHistory(seed.id, 'added', null, now)
    }
  })
}

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('app')
  if (!s) throw new Error('設定がまだありません')
  return s
}

// ---- 睡眠 ----

export async function getOpenSleep(): Promise<Sleep | undefined> {
  const all = await db.sleeps.toArray()
  return alive(all)
    .filter((s) => s.end === null)
    .sort((a, b) => b.start.localeCompare(a.start))[0]
}

/** 「寝る」:睡眠を始める。すでに睡眠中なら何もしない */
export async function startSleep(now = new Date()): Promise<Sleep> {
  return db.transaction('rw', db.sleeps, async () => {
    const open = await getOpenSleep()
    if (open) return open
    const sleep: Sleep = { ...newRow(now), start: iso(now), end: null, startMethod: 'live', endMethod: null }
    await db.sleeps.add(sleep)
    return sleep
  })
}

/** 「起きた」:睡眠を終える。押し忘れの補完では method に 'added' を渡す */
export async function endSleep(id: string, end: Date, method: RecordMethod, now = new Date()): Promise<void> {
  await db.sleeps.update(id, { end: iso(end), endMethod: method, updatedAt: iso(now) })
}

/** 押し忘れた睡眠を後から追加する */
export async function addSleep(start: Date, end: Date | null, now = new Date()): Promise<Sleep> {
  const sleep: Sleep = {
    ...newRow(now),
    start: iso(start),
    end: end ? iso(end) : null,
    startMethod: 'added',
    endMethod: end ? 'added' : null,
  }
  await db.sleeps.add(sleep)
  return sleep
}

/** 睡眠の開始・終了を後から修正する */
export async function updateSleep(id: string, start: Date, end: Date | null, now = new Date()): Promise<void> {
  const cur = await db.sleeps.get(id)
  if (!cur) return
  const startIso = iso(start)
  const endIso = end ? iso(end) : null
  await db.sleeps.update(id, {
    start: startIso,
    end: endIso,
    startMethod: startIso !== cur.start ? 'edited' : cur.startMethod,
    endMethod: endIso === null ? null : endIso !== cur.end ? 'edited' : cur.endMethod,
    updatedAt: iso(now),
  })
}

export async function deleteSleep(id: string, now = new Date()): Promise<void> {
  await db.sleeps.update(id, { deletedAt: iso(now), updatedAt: iso(now) })
}

// ---- 記録 ----

/**
 * きょう画面からの入力。1日1回の項目は、同じ日・同じ時間帯の記録があれば値を置き換える。
 * 1日に何回も記録できる項目(気分など)は、毎回新しい記録を足す。
 */
export async function saveTodayValue(
  item: ItemDef,
  value: RecordValue,
  slot: TimeSlot | null,
  cutoffMinutes: number,
  now = new Date(),
): Promise<LogRecord> {
  return db.transaction('rw', db.records, async () => {
    if (!item.multiplePerDay) {
      const existing = await findTodayRecord(item.id, slot, cutoffMinutes, now)
      if (existing) {
        await db.records.update(existing.id, { value, updatedAt: iso(now) })
        return { ...existing, value }
      }
    }
    const rec: LogRecord = { ...newRow(now), itemId: item.id, at: iso(now), value, slot, method: 'live' }
    await db.records.add(rec)
    return rec
  })
}

/** きょう画面で、いま入力した記録の値を直す(スライダーを動かし直したときなど) */
export async function changeTodayValue(id: string, value: RecordValue, now = new Date()): Promise<void> {
  await db.records.update(id, { value, updatedAt: iso(now) })
}

/** きょう画面で入力を取り消す(チェックを外す、選択をやめるなど) */
export async function clearTodayValue(itemId: string, slot: TimeSlot | null, cutoffMinutes: number, now = new Date()) {
  const existing = await findTodayRecord(itemId, slot, cutoffMinutes, now)
  if (existing) await deleteRecord(existing.id, now)
}

async function findTodayRecord(itemId: string, slot: TimeSlot | null, cutoffMinutes: number, now: Date) {
  const today = logicalDay(iso(now), cutoffMinutes)
  const rows = alive(await db.records.where('itemId').equals(itemId).toArray())
  return rows
    .filter((r) => r.slot === slot && logicalDay(r.at, cutoffMinutes) === today)
    .sort((a, b) => b.at.localeCompare(a.at))[0]
}

/** 記録の一覧から、後で記録を足す */
export async function addRecord(
  itemId: string,
  at: Date,
  value: RecordValue,
  slot: TimeSlot | null,
  now = new Date(),
): Promise<LogRecord> {
  const rec: LogRecord = { ...newRow(now), itemId, at: iso(at), value, slot, method: 'added' }
  await db.records.add(rec)
  return rec
}

export async function updateRecord(
  id: string,
  patch: { at?: Date; value?: RecordValue; slot?: TimeSlot | null },
  now = new Date(),
): Promise<void> {
  await db.records.update(id, {
    ...(patch.at ? { at: iso(patch.at) } : {}),
    ...(patch.value !== undefined ? { value: patch.value } : {}),
    ...(patch.slot !== undefined ? { slot: patch.slot } : {}),
    method: 'edited',
    updatedAt: iso(now),
  })
}

export async function deleteRecord(id: string, now = new Date()): Promise<void> {
  await db.records.update(id, { deletedAt: iso(now), updatedAt: iso(now) })
}

// ---- 項目と設定 ----

async function addItemHistory(itemId: string, change: ItemChange, detail: string | null, now: Date) {
  await db.itemDefHistory.add({ ...newRow(now), itemId, at: iso(now), change, detail })
}

/** 任意項目の表示・非表示。中心項目は非表示にできない */
export async function setItemVisible(itemId: string, visible: boolean, now = new Date()): Promise<void> {
  await db.transaction('rw', db.itemDefs, db.itemDefHistory, async () => {
    const item = await db.itemDefs.get(itemId)
    if (!item || item.visible === visible) return
    if (item.core && !visible) return
    await db.itemDefs.update(itemId, { visible, updatedAt: iso(now) })
    await addItemHistory(itemId, visible ? 'shown' : 'hidden', null, now)
  })
}

/** 1日の区切り時刻を変える。保存済みの記録は書き換えず、変更履歴だけ残す */
export async function setCutoff(minutes: number, now = new Date()): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const s = await getSettings()
    if (s.cutoffMinutes === minutes) return
    await db.settings.update('app', {
      cutoffMinutes: minutes,
      cutoffHistory: [...s.cutoffHistory, { at: iso(now), minutes }],
      updatedAt: iso(now),
    })
  })
}

// ---- バックアップと復元 ----

export async function exportAll(now = new Date()): Promise<BackupData> {
  return db.transaction('r', [db.itemDefs, db.itemDefHistory, db.sleeps, db.records, db.settings], async () => ({
    app: 'daily-log' as const,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: iso(now),
    itemDefs: await db.itemDefs.toArray(),
    itemDefHistory: await db.itemDefHistory.toArray(),
    sleeps: await db.sleeps.toArray(),
    records: await db.records.toArray(),
    settings: await getSettings(),
  }))
}

export async function markBackedUp(now = new Date()): Promise<void> {
  await db.settings.update('app', { lastBackupAt: iso(now), updatedAt: iso(now) })
}

/** JSON バックアップから復元する。今のデータはすべて置き換わる */
export async function restoreAll(raw: unknown): Promise<void> {
  const data = migrateBackup(raw)
  await db.transaction('rw', [db.itemDefs, db.itemDefHistory, db.sleeps, db.records, db.settings], async () => {
    await Promise.all([
      db.itemDefs.clear(),
      db.itemDefHistory.clear(),
      db.sleeps.clear(),
      db.records.clear(),
      db.settings.clear(),
    ])
    await db.itemDefs.bulkPut(data.itemDefs)
    await db.itemDefHistory.bulkPut(data.itemDefHistory)
    await db.sleeps.bulkPut(data.sleeps)
    await db.records.bulkPut(data.records)
    await db.settings.put({ ...data.settings, key: 'app' })
  })
  // 復元したデータに無い初期項目があれば足す
  await ensureInitialized()
}

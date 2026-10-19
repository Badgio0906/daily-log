// 保存形式のバージョンと移行処理。
// データの形を変えるときは SCHEMA_VERSION を1つ上げ、MIGRATIONS にその版への移行を書く。
// 同じ移行を、端末内の保存先(Dexie)の更新と、JSON バックアップの復元の両方で使う。

import type { BackupData } from './types'

export const SCHEMA_VERSION = 1

type Row = Record<string, unknown>
type RowFn = (row: Row) => Row

/** ある版への移行。表ごとに1件ずつ変換する */
export interface MigrationStep {
  itemDefs?: RowFn
  itemDefHistory?: RowFn
  sleeps?: RowFn
  records?: RowFn
  settings?: RowFn
}

export const TABLES = ['itemDefs', 'itemDefHistory', 'sleeps', 'records', 'settings'] as const
export type TableName = (typeof TABLES)[number]

/** キーは移行後の版。例:MIGRATIONS[2] は版1 → 版2 */
export const MIGRATIONS: Record<number, MigrationStep> = {}

/** 表ごとの保存先の定義(Dexie の索引)。版が変わっても過去の版の定義を残す */
export const STORES: Record<number, Record<TableName, string>> = {
  1: {
    itemDefs: 'id, order',
    itemDefHistory: 'id, itemId, at',
    sleeps: 'id, start',
    records: 'id, itemId, at',
    settings: 'key',
  },
}

export class BackupFormatError extends Error {}

/**
 * JSON バックアップを読み込める形に整え、古い版なら今の版まで移行する。
 * migrations と targetVersion はテストのために差し替えられる。
 */
export function migrateBackup(
  raw: unknown,
  migrations: Record<number, MigrationStep> = MIGRATIONS,
  targetVersion: number = SCHEMA_VERSION,
): BackupData {
  if (typeof raw !== 'object' || raw === null) {
    throw new BackupFormatError('バックアップの形式ではありません')
  }
  const data = raw as Record<string, unknown>
  if (data.app !== 'daily-log') {
    throw new BackupFormatError('このアプリのバックアップではありません')
  }
  const from = data.schemaVersion
  if (typeof from !== 'number' || !Number.isInteger(from) || from < 1) {
    throw new BackupFormatError('保存形式のバージョンが読み取れません')
  }
  if (from > targetVersion) {
    throw new BackupFormatError('新しいバージョンのアプリで作ったバックアップです。アプリを更新してから復元してください')
  }
  for (const key of ['itemDefs', 'itemDefHistory', 'sleeps', 'records'] as const) {
    if (!Array.isArray(data[key])) throw new BackupFormatError('バックアップの中身が足りません')
  }
  if (typeof data.settings !== 'object' || data.settings === null) {
    throw new BackupFormatError('バックアップの中身が足りません')
  }

  let tables: Record<TableName, Row[]> = {
    itemDefs: data.itemDefs as Row[],
    itemDefHistory: data.itemDefHistory as Row[],
    sleeps: data.sleeps as Row[],
    records: data.records as Row[],
    settings: [data.settings as Row],
  }
  for (let v = from + 1; v <= targetVersion; v++) {
    const step = migrations[v]
    if (!step) continue
    tables = applyStep(tables, step)
  }

  return {
    app: 'daily-log',
    schemaVersion: targetVersion,
    exportedAt: String(data.exportedAt ?? ''),
    itemDefs: tables.itemDefs as unknown as BackupData['itemDefs'],
    itemDefHistory: tables.itemDefHistory as unknown as BackupData['itemDefHistory'],
    sleeps: tables.sleeps as unknown as BackupData['sleeps'],
    records: tables.records as unknown as BackupData['records'],
    settings: { ...(tables.settings[0] as unknown as BackupData['settings']), schemaVersion: targetVersion },
  }
}

function applyStep(tables: Record<TableName, Row[]>, step: MigrationStep): Record<TableName, Row[]> {
  const out = { ...tables }
  for (const t of TABLES) {
    const fn = step[t]
    if (fn) out[t] = tables[t].map((r) => fn({ ...r }))
  }
  return out
}

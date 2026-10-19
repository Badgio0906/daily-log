import { describe, expect, test } from 'vitest'
import { BackupFormatError, SCHEMA_VERSION, migrateBackup, type MigrationStep } from './migrations'

const v1Backup = {
  app: 'daily-log',
  schemaVersion: 1,
  exportedAt: '2026-10-01T00:00:00.000Z',
  itemDefs: [{ id: 'a', name: '気分' }],
  itemDefHistory: [],
  sleeps: [{ id: 's1', start: '2026-10-01T13:00:00.000Z', end: null }],
  records: [],
  settings: { key: 'app', cutoffMinutes: 240, schemaVersion: 1 },
}

describe('JSON バックアップの移行', () => {
  test('今の版のデータはそのまま読める', () => {
    const out = migrateBackup(v1Backup)
    expect(out.schemaVersion).toBe(SCHEMA_VERSION)
    expect(out.sleeps).toHaveLength(1)
  })

  test('古い版のデータは、版を順に上げて読み込む', () => {
    const steps: Record<number, MigrationStep> = {
      2: { sleeps: (r) => ({ ...r, note: null }) },
      3: { itemDefs: (r) => ({ ...r, name: `${r.name}(新)` }), settings: (r) => ({ ...r, extra: true }) },
    }
    const out = migrateBackup(v1Backup, steps, 3)
    expect(out.schemaVersion).toBe(3)
    expect(out.settings.schemaVersion).toBe(3)
    expect((out.sleeps[0] as unknown as Record<string, unknown>).note).toBeNull()
    expect(out.itemDefs[0].name).toBe('気分(新)')
    expect((out.settings as unknown as Record<string, unknown>).extra).toBe(true)
    // 元のデータは書き換えない
    expect(v1Backup.itemDefs[0].name).toBe('気分')
  })

  test('新しい版のアプリで作ったデータは読み込まない', () => {
    expect(() => migrateBackup({ ...v1Backup, schemaVersion: SCHEMA_VERSION + 1 })).toThrow(BackupFormatError)
  })

  test('形式が違うものは読み込まない', () => {
    expect(() => migrateBackup(null)).toThrow(BackupFormatError)
    expect(() => migrateBackup({ ...v1Backup, app: 'other' })).toThrow(BackupFormatError)
    expect(() => migrateBackup({ ...v1Backup, sleeps: undefined })).toThrow(BackupFormatError)
  })
})

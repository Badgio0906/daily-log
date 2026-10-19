// 保存するデータの形。日時はすべて UTC の ISO 形式の文字列で持つ。

/** すべてのデータが持つ共通の欄 */
export interface BaseRow {
  id: string
  createdAt: string
  updatedAt: string
  /** 削除日時。削除は実際には消さず、ここに日時を入れるだけ */
  deletedAt: string | null
}

/** 入力タイプ:チェック、単一選択、複数選択、スライダー、数値、一言メモ */
export type InputType = 'check' | 'single' | 'multi' | 'slider' | 'number' | 'memo'

/** 時間帯:朝・昼・夜 */
export type TimeSlot = 'morning' | 'noon' | 'night'
export const TIME_SLOTS: TimeSlot[] = ['morning', 'noon', 'night']
export const TIME_SLOT_LABEL: Record<TimeSlot, string> = {
  morning: '朝',
  noon: '昼',
  night: '夜',
}

/** 記録方法:その場で記録した / 後から追加した / 後から修正した */
export type RecordMethod = 'live' | 'added' | 'edited'
export const RECORD_METHOD_LABEL: Record<RecordMethod, string> = {
  live: 'その場で記録した',
  added: '後から追加した',
  edited: '後から修正した',
}

export interface SliderRange {
  min: number
  max: number
  step: number
}

/** 項目の定義 */
export interface ItemDef extends BaseRow {
  name: string
  inputType: InputType
  /** 選択肢。チェックの場合は1つ目がチェック欄の文言 */
  options: string[]
  /** スライダー・数値の範囲 */
  range: SliderRange | null
  order: number
  /** 中心項目は非表示にできない */
  core: boolean
  visible: boolean
  /** 共有の初期値(第2弾以降で使う)。初期は共有しない */
  shareDefault: boolean
  /** 朝・昼・夜を分けて入力するか */
  useTimeSlots: boolean
  /** 1日に何回も記録できるか(気分など)。false なら同じ日・時間帯の記録を上書きする */
  multiplePerDay: boolean
}

export type ItemChange = 'added' | 'renamed' | 'hidden' | 'shown'

/** 項目の変更履歴 */
export interface ItemDefHistory extends BaseRow {
  itemId: string
  at: string
  change: ItemChange
  /** 名前の変更なら「前の名前 → 新しい名前」など */
  detail: string | null
}

/** 睡眠 */
export interface Sleep extends BaseRow {
  start: string
  /** 未終了なら null */
  end: string | null
  startMethod: RecordMethod
  endMethod: RecordMethod | null
}

export type RecordValue = boolean | string | string[] | number

/** 記録(睡眠以外の項目) */
export interface LogRecord extends BaseRow {
  itemId: string
  /** 対象日時 */
  at: string
  value: RecordValue
  slot: TimeSlot | null
  method: RecordMethod
}

export interface CutoffChange {
  /** 変更した日時 */
  at: string
  /** 変更後の区切り時刻(0:00 からの分) */
  minutes: number
}

/** 設定(1件だけ持つ) */
export interface Settings extends BaseRow {
  key: 'app'
  /** 1日の区切り時刻(0:00 からの分) */
  cutoffMinutes: number
  cutoffHistory: CutoffChange[]
  lastBackupAt: string | null
  schemaVersion: number
}

/** JSON バックアップの中身 */
export interface BackupData {
  app: 'daily-log'
  schemaVersion: number
  exportedAt: string
  itemDefs: ItemDef[]
  itemDefHistory: ItemDefHistory[]
  sleeps: Sleep[]
  records: LogRecord[]
  settings: Settings
}

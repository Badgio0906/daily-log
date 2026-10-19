// 記録の値を文字にする(画面・書き出しで共通)

import type { ItemDef, RecordValue } from '../db/types'

export function formatValue(item: ItemDef | undefined, value: RecordValue): string {
  if (Array.isArray(value)) return value.join('・')
  if (typeof value === 'boolean') return value ? (item?.options[0] ?? 'はい') : ''
  if (typeof value === 'number') {
    if (item?.inputType === 'slider' && item.range && item.range.min < 0) {
      return value > 0 ? `+${value}` : String(value)
    }
    return String(value)
  }
  return value
}

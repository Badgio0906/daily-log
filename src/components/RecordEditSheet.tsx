import { useState } from 'react'
import { addRecord, deleteRecord, updateRecord } from '../db/db'
import { TIME_SLOTS, TIME_SLOT_LABEL, type ItemDef, type LogRecord, type RecordValue, type TimeSlot } from '../db/types'
import { DateTimeField } from './DateTimeField'
import { Sheet } from './Sheet'
import { ValueInput } from './ValueInput'

/** 記録(睡眠以外)の追加・修正・削除 */
export function RecordEditSheet({
  record,
  items,
  defaultAt,
  onClose,
}: {
  /** 修正するときの記録。無ければ追加 */
  record?: LogRecord
  /** 選べる項目(並び順どおり) */
  items: ItemDef[]
  defaultAt?: Date
  onClose: () => void
}) {
  const [itemId, setItemId] = useState(record?.itemId ?? items[0]?.id)
  const item = items.find((i) => i.id === itemId)
  const [at, setAt] = useState(() => (record ? new Date(record.at) : (defaultAt ?? new Date())))
  const [slot, setSlot] = useState<TimeSlot | null>(record?.slot ?? null)
  const [value, setValue] = useState<RecordValue | undefined>(record?.value)

  const effectiveSlot = item?.useTimeSlots ? (slot ?? 'morning') : null
  const valid = item && value !== undefined

  const save = async () => {
    if (!item || value === undefined) return
    if (record) await updateRecord(record.id, { at, value, slot: effectiveSlot })
    else await addRecord(item.id, at, value, effectiveSlot)
    onClose()
  }

  const remove = async () => {
    if (!record) return
    if (!confirm('この記録を削除しますか?')) return
    await deleteRecord(record.id)
    onClose()
  }

  return (
    <Sheet title={record ? '記録を直す' : '記録を追加'} onClose={onClose}>
      {record ? (
        <h3>{item?.name}</h3>
      ) : (
        <label className="field">
          <span className="field-label">項目</span>
          <select
            value={itemId}
            onChange={(e) => {
              setItemId(e.target.value)
              setValue(undefined)
            }}
          >
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
                {i.visible ? '' : '(非表示中)'}
              </option>
            ))}
          </select>
        </label>
      )}
      <DateTimeField label="日時" value={at} onChange={setAt} />
      {item?.useTimeSlots && (
        <div className="field">
          <span className="field-label">時間帯</span>
          <div className="chips">
            {TIME_SLOTS.map((s) => (
              <button key={s} className={`chip ${effectiveSlot === s ? 'on' : ''}`} onClick={() => setSlot(s)}>
                {TIME_SLOT_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      )}
      {item && (
        <div className="field">
          <span className="field-label">内容</span>
          <ValueInput key={item.id} item={item} value={value} onChange={setValue} />
        </div>
      )}
      <div className="sheet-actions">
        <button className="btn-primary" disabled={!valid} onClick={save}>
          {record ? 'この内容にする' : '追加する'}
        </button>
        {record && (
          <button className="btn-danger" onClick={remove}>
            削除
          </button>
        )}
      </div>
    </Sheet>
  )
}

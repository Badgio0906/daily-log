import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { alive, db } from './db/db'
import type { ItemDef, LogRecord, Settings, Sleep } from './db/types'

export interface AppData {
  settings: Settings
  /** 並び順どおりの項目の定義(非表示も含む) */
  items: ItemDef[]
  itemById: Map<string, ItemDef>
  /** 削除されていない睡眠 */
  sleeps: Sleep[]
  /** 削除されていない記録 */
  records: LogRecord[]
}

/** 保存されたデータを読み、変わったら自動で画面を更新する */
export function useAppData(): AppData | undefined {
  return useLiveQuery(async () => {
    const [settings, items, sleeps, records] = await Promise.all([
      db.settings.get('app'),
      db.itemDefs.orderBy('order').toArray(),
      db.sleeps.toArray(),
      db.records.toArray(),
    ])
    if (!settings) return undefined
    const liveItems = alive(items)
    return {
      settings,
      items: liveItems,
      itemById: new Map(liveItems.map((i) => [i.id, i])),
      sleeps: alive(sleeps),
      records: alive(records),
    }
  })
}

/** 今の時刻。少しずつ進める */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    const onVisible = () => document.visibilityState === 'visible' && setNow(new Date())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs])
  return now
}

import { useRef, useState } from 'react'
import { PeriodPicker, presetPeriod, type Period } from '../components/PeriodPicker'
import { exportAll, markBackedUp, restoreAll } from '../db/db'
import type { AppData } from '../hooks'
import { recordCsv, sleepCsv } from '../logic/csv'
import { formatCutoff, formatJst, logicalDay } from '../logic/day'
import { shareFile } from '../logic/share'

export interface ReportRequest {
  period: Period
  includeMemo: boolean
}

export function ExportScreen({
  data,
  now,
  onOpenReport,
}: {
  data: AppData
  now: Date
  onOpenReport: (r: ReportRequest) => void
}) {
  const cutoff = data.settings.cutoffMinutes
  const today = logicalDay(now, cutoff)
  const [period, setPeriod] = useState<Period>(() => presetPeriod('4w', today))
  const [includeMemo, setIncludeMemo] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const range = `${period.from}_${period.to}`

  const run = async (fn: () => Promise<string | null>) => {
    setMessage(null)
    try {
      setMessage(await fn())
    } catch (e) {
      console.error(e)
      setMessage(e instanceof Error ? e.message : 'うまくいきませんでした')
    }
  }

  const exportSleepCsv = () =>
    run(async () => {
      const csv = sleepCsv(data.sleeps, cutoff, period.from, period.to, new Date())
      const r = await shareFile(csv, `daily-log-sleep_${range}.csv`, 'text/csv')
      return r === 'cancelled' ? null : '睡眠の CSV を書き出しました'
    })

  const exportRecordCsv = () =>
    run(async () => {
      const csv = recordCsv(data.records, data.itemById, cutoff, period.from, period.to, includeMemo)
      const r = await shareFile(csv, `daily-log-items_${range}.csv`, 'text/csv')
      return r === 'cancelled' ? null : '項目の CSV を書き出しました'
    })

  const exportJson = () =>
    run(async () => {
      const backup = await exportAll()
      const name = `daily-log-backup_${formatJst(new Date(), 'yyyy-MM-dd')}.json`
      const r = await shareFile(JSON.stringify(backup, null, 1), name, 'application/json')
      if (r === 'cancelled') return null
      await markBackedUp()
      return 'バックアップを書き出しました。「ファイル」アプリなどに保存しておいてください'
    })

  const restore = (file: File) =>
    run(async () => {
      const text = await file.text()
      let raw: unknown
      try {
        raw = JSON.parse(text)
      } catch {
        throw new Error('バックアップのファイルとして読めませんでした')
      }
      if (!confirm('今のデータはすべて、このバックアップの内容に置き換わります。よろしいですか?')) return null
      await restoreAll(raw)
      return 'バックアップから元に戻しました'
    })

  return (
    <div className="screen">
      <h1>書き出し</h1>
      {message && (
        <p className="gentle-note" role="status">
          {message}
        </p>
      )}

      <section className="card">
        <h2>期間</h2>
        <PeriodPicker value={period} today={today} onChange={setPeriod} />
        <p className="muted small">日付は今の区切り時刻({formatCutoff(cutoff)})で数えます。ファイルにも書いてあります。</p>
        <label className="check-row">
          <input type="checkbox" checked={includeMemo} onChange={(e) => setIncludeMemo(e.target.checked)} />
          一言メモも含める
        </label>
      </section>

      <section className="card">
        <h2>医師や家族に見せる</h2>
        <div className="stack">
          <button className="btn-primary btn-block" onClick={() => onOpenReport({ period, includeMemo })}>
            PDF 用のレポートを開く
          </button>
          <p className="muted small">開いた画面の「プリント」から、共有ボタン →「PDFとして保存」できます。</p>
          <button className="btn-secondary btn-block" onClick={exportSleepCsv}>
            睡眠の CSV
          </button>
          <button className="btn-secondary btn-block" onClick={exportRecordCsv}>
            項目の CSV
          </button>
        </div>
      </section>

      <section className="card">
        <h2>バックアップ</h2>
        <p className="muted small">
          機種変更やもしものときのために、すべての記録を1つのファイルに保存します(期間の指定に関係なく全部)。
          {data.settings.lastBackupAt
            ? ` 前回:${formatJst(data.settings.lastBackupAt, 'M/d H:mm')}`
            : ' まだ保存したことがありません。'}
        </p>
        <div className="stack">
          <button className="btn-primary btn-block" onClick={exportJson}>
            バックアップを書き出す
          </button>
          <button className="btn-secondary btn-block" onClick={() => fileInput.current?.click()}>
            バックアップから元に戻す
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) restore(f)
            }}
          />
        </div>
      </section>

    </div>
  )
}

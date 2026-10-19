import { useMemo } from 'react'
import { MoodSleepChart, SleepDurationChart, SleepLegend, SleepTimelineChart } from '../charts/PeriodCharts'
import { LIGHT } from '../charts/theme'
import { CutoffNote } from '../components/CutoffNote'
import { ITEM_IDS } from '../db/seed'
import { TIME_SLOT_LABEL, type LogRecord } from '../db/types'
import type { AppData } from '../hooks'
import { buildPeriodChartData } from '../logic/chartData'
import { daysBetween, formatDayLabel, formatJst, logicalDay, type Day } from '../logic/day'
import { formatValue } from '../logic/format'
import { formatMinutes, groupSleepsByDay } from '../logic/sleep'
import type { ReportRequest } from './ExportScreen'

/** 印刷用のレポート。iPhone のプリント機能で PDF にする */
export function ReportView({
  data,
  now,
  request,
  onClose,
}: {
  data: AppData
  now: Date
  request: ReportRequest
  onClose: () => void
}) {
  const { period, includeMemo } = request
  const cutoff = data.settings.cutoffMinutes
  const chart = useMemo(
    () => buildPeriodChartData(data.sleeps, data.records, ITEM_IDS.mood, cutoff, period.from, period.to, now),
    [data, cutoff, period, now],
  )
  const sleepsByDay = useMemo(() => groupSleepsByDay(data.sleeps, cutoff, now), [data.sleeps, cutoff, now])
  const recordsByDay = useMemo(() => {
    const map = new Map<Day, LogRecord[]>()
    for (const r of [...data.records].sort((a, b) => a.at.localeCompare(b.at))) {
      const d = logicalDay(r.at, cutoff)
      map.set(d, [...(map.get(d) ?? []), r])
    }
    return map
  }, [data.records, cutoff])

  const otherItems = data.items.filter(
    (i) => i.id !== ITEM_IDS.mood && (includeMemo || i.inputType !== 'memo'),
  )
  const mood = data.itemById.get(ITEM_IDS.mood)

  return (
    <div className="report-wrap">
      <div className="report-toolbar no-print">
        <button className="btn-text" onClick={onClose}>
          ← 戻る
        </button>
        <button className="btn-primary" onClick={() => window.print()}>
          プリント
        </button>
      </div>
      <p className="muted small no-print report-hint">
        「プリント」を押したあと、共有ボタンから「PDFとして保存」を選ぶと PDF になります。
      </p>

      <article className="report">
        <header>
          <h1>生活リズムの記録</h1>
          <p>
            {formatDayLabel(period.from)} 〜 {formatDayLabel(period.to)}({period.from.slice(0, 4)}年)
            <span className="muted"> 作成:{formatJst(now, 'yyyy/M/d H:mm')}</span>
          </p>
          <CutoffNote history={data.settings.cutoffHistory} from={period.from} to={period.to} cutoffMinutes={cutoff} />
        </header>

        <section className="report-section">
          <h2>睡眠時間</h2>
          <SleepLegend maxIndex={chart.maxIndex} />
          <SleepDurationChart data={chart} theme={LIGHT} />
        </section>
        <section className="report-section">
          <h2>睡眠の時間帯</h2>
          <SleepTimelineChart data={chart} theme={LIGHT} cutoffMinutes={cutoff} />
        </section>
        <section className="report-section">
          <h2>気分と睡眠</h2>
          <p className="muted small">上:気分(−3〜+3、0がふつう) 下:その日の睡眠時間の合計</p>
          <MoodSleepChart data={chart} theme={LIGHT} />
        </section>

        <section className="report-section table-section">
          <h2>日ごとの記録</h2>
          <table className="report-table">
            <thead>
              <tr>
                <th>日付</th>
                <th>睡眠</th>
                <th>気分</th>
                <th>そのほか</th>
              </tr>
            </thead>
            <tbody>
              {daysBetween(period.from, period.to).map((day) => {
                const sleeps = sleepsByDay.get(day) ?? []
                const recs = recordsByDay.get(day) ?? []
                const total = sleeps.reduce((m, s) => m + s.minutes, 0)
                return (
                  <tr key={day}>
                    <td className="nowrap">{formatDayLabel(day)}</td>
                    <td>
                      {sleeps.map((s) => (
                        <div key={s.sleep.id} className="nowrap">
                          {s.index}回目 {formatJst(s.sleep.start, 'H:mm')}〜
                          {s.sleep.end ? formatJst(s.sleep.end, 'H:mm') : '睡眠中'}
                          {s.ongoing ? '' : `(${formatMinutes(s.minutes)})`}
                        </div>
                      ))}
                      {sleeps.length > 1 && <div className="muted">合計 {formatMinutes(total)}</div>}
                    </td>
                    <td>
                      {recs
                        .filter((r) => r.itemId === ITEM_IDS.mood)
                        .map((r) => (
                          <div key={r.id} className="nowrap">
                            {formatJst(r.at, 'H:mm')} {formatValue(mood, r.value)}
                          </div>
                        ))}
                    </td>
                    <td>
                      {otherItems.map((item) => {
                        const list = recs.filter((r) => r.itemId === item.id)
                        if (!list.length) return null
                        const text = list
                          .map((r) => {
                            const v = item.inputType === 'check' ? '' : formatValue(item, r.value)
                            const slot = r.slot ? TIME_SLOT_LABEL[r.slot] : ''
                            return [slot, v].filter(Boolean).join(':')
                          })
                          .filter(Boolean)
                          .join('、')
                        return (
                          <div key={item.id}>
                            {item.name}
                            {text ? `:${text}` : ''}
                          </div>
                        )
                      })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
        <footer className="muted small">
          本人の自己記録です。アプリによる診断・判定は行っていません。
        </footer>
      </article>
    </div>
  )
}

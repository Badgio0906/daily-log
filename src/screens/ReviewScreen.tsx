import { useMemo, useState } from 'react'
import { useDarkMode } from '../charts/EChart'
import { MoodSleepChart, SleepDurationChart, SleepLegend, SleepTimelineChart } from '../charts/PeriodCharts'
import { DARK, LIGHT } from '../charts/theme'
import { CutoffNote } from '../components/CutoffNote'
import { PeriodPicker, presetPeriod, type Period } from '../components/PeriodPicker'
import { ITEM_IDS } from '../db/seed'
import type { AppData } from '../hooks'
import { buildPeriodChartData } from '../logic/chartData'
import { logicalDay } from '../logic/day'

export function ReviewScreen({ data, now }: { data: AppData; now: Date }) {
  const cutoff = data.settings.cutoffMinutes
  const today = logicalDay(now, cutoff)
  const [period, setPeriod] = useState<Period>(() => presetPeriod('1w', today))
  const theme = useDarkMode() ? DARK : LIGHT

  const chart = useMemo(
    () => buildPeriodChartData(data.sleeps, data.records, ITEM_IDS.mood, cutoff, period.from, period.to, now),
    [data.sleeps, data.records, cutoff, period.from, period.to, now],
  )

  return (
    <div className="screen">
      <h1>振り返り</h1>
      <PeriodPicker value={period} today={today} onChange={setPeriod} />
      <CutoffNote history={data.settings.cutoffHistory} from={period.from} to={period.to} cutoffMinutes={cutoff} />

      <section className="card">
        <h2>睡眠時間</h2>
        <SleepLegend maxIndex={chart.maxIndex} />
        <SleepDurationChart data={chart} theme={theme} />
      </section>

      <section className="card">
        <h2>睡眠の時間帯</h2>
        <SleepLegend maxIndex={chart.maxIndex} />
        <SleepTimelineChart data={chart} theme={theme} cutoffMinutes={cutoff} />
      </section>

      <section className="card">
        <h2>気分と睡眠</h2>
        <p className="muted small">上が気分(記録した時刻の位置)、下がその日の睡眠時間の合計です。</p>
        <MoodSleepChart data={chart} theme={theme} />
      </section>
      <p className="muted small">グラフをタップすると、時刻と長さが出ます。</p>
    </div>
  )
}

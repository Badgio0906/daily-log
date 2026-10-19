import { useMemo } from 'react'
import type { PeriodChartData, SleepSegment } from '../logic/chartData'
import { formatCutoff, formatDayLabel, formatJst } from '../logic/day'
import { formatMinutes, sleepColorIndex } from '../logic/sleep'
import { EChart, type ChartOption } from './EChart'
import { SLEEP_LABELS, type ChartTheme } from './theme'

const ONGOING_OPACITY = 0.35

const shortDay = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`

function segmentTip(s: SleepSegment): string {
  const end = s.end ? formatJst(s.end, 'H:mm') : '睡眠中'
  return `${formatDayLabel(s.day)} ${s.index}回目<br/>${formatJst(s.start, 'H:mm')}〜${end}(${formatMinutes(s.minutes)})`
}

function baseText(t: ChartTheme) {
  return { color: t.muted, fontSize: 11 }
}

function tooltip(t: ChartTheme) {
  return {
    trigger: 'item',
    triggerOn: 'mousemove|click',
    confine: true,
    backgroundColor: t.surface,
    borderColor: t.grid,
    textStyle: { color: t.text, fontSize: 13 },
  }
}

/** 回ごとの色の凡例(色だけに頼らないよう文字も添える) */
export function SleepLegend({ maxIndex }: { maxIndex: number }) {
  const n = Math.max(1, Math.min(4, maxIndex))
  return (
    <div className="legend">
      {SLEEP_LABELS.slice(0, n).map((l, i) => (
        <span key={l} className="legend-item">
          <span className={`dot c${i + 1}`} aria-hidden />
          {l}
        </span>
      ))}
      <span className="legend-item muted">
        <span className="dot c1 faint" aria-hidden />
        薄い色=睡眠中
      </span>
    </div>
  )
}

/** 睡眠時間:日ごとの積み上げ棒 */
export function SleepDurationChart({ data, theme }: { data: PeriodChartData; theme: ChartTheme }) {
  const option = useMemo<ChartOption>(() => {
    const series = []
    for (let idx = 1; idx <= Math.max(1, data.maxIndex); idx++) {
      const color = theme.sleep[sleepColorIndex(idx)]
      series.push({
        type: 'bar',
        stack: 'sleep',
        name: SLEEP_LABELS[sleepColorIndex(idx)],
        barMaxWidth: 28,
        data: data.days.map((day) => {
          const s = data.segments.find((x) => x.day === day && x.index === idx)
          if (!s) return null
          return {
            value: +(s.minutes / 60).toFixed(2),
            tip: segmentTip(s),
            itemStyle: {
              color,
              opacity: s.ongoing ? ONGOING_OPACITY : 1,
              borderColor: theme.surface,
              borderWidth: 1,
              borderRadius: 2,
            },
          }
        }),
      })
    }
    return {
      animation: false,
      grid: { left: 36, right: 12, top: 16, bottom: 28 },
      tooltip: { ...tooltip(theme), formatter: (p: { data: { tip: string } }) => p.data?.tip ?? '' },
      xAxis: {
        type: 'category',
        data: data.days.map(shortDay),
        axisLabel: baseText(theme),
        axisLine: { lineStyle: { color: theme.grid } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        minInterval: 1,
        axisLabel: { ...baseText(theme), formatter: '{value}時間' },
        splitLine: { lineStyle: { color: theme.grid } },
      },
      series,
    }
  }, [data, theme])
  return <EChart option={option} height={220} label="日ごとの睡眠時間" />
}

/** 睡眠の時間帯:区切り時刻から24時間の帯に、眠っていた時間を塗る */
export function SleepTimelineChart({
  data,
  theme,
  cutoffMinutes,
}: {
  data: PeriodChartData
  theme: ChartTheme
  cutoffMinutes: number
}) {
  const maxH = Math.min(48, Math.max(24, Math.ceil(Math.max(0, ...data.segments.map((s) => s.toH)) / 6) * 6))
  const option = useMemo<ChartOption>(
    () => ({
      animation: false,
      grid: { left: 44, right: 14, top: 10, bottom: 26 },
      tooltip: { ...tooltip(theme), formatter: (p: { data: { tip: string } }) => p.data?.tip ?? '' },
      xAxis: {
        type: 'value',
        min: 0,
        max: maxH,
        interval: 6,
        axisLabel: {
          ...baseText(theme),
          formatter: (v: number) => formatCutoff((cutoffMinutes + v * 60) % 1440).replace(':00', '時'),
        },
        splitLine: { lineStyle: { color: theme.grid } },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: data.days.map(shortDay),
        axisLabel: baseText(theme),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: theme.grid } },
      },
      series: [
        {
          type: 'custom',
          encode: { x: [0, 1], y: 2 },
          data: data.segments.map((s) => ({
            value: [s.fromH, s.toH, s.dayIndex, sleepColorIndex(s.index), s.ongoing ? 1 : 0],
            tip: segmentTip(s),
          })),
          renderItem: (
            _params: unknown,
            api: {
              value: (i: number) => number
              coord: (v: number[]) => number[]
              size: (v: number[]) => number[]
            },
          ) => {
            const [x0, y] = api.coord([api.value(0), api.value(2)])
            const [x1] = api.coord([Math.min(api.value(1), maxH), api.value(2)])
            const h = Math.max(6, api.size([0, 1])[1] * 0.62)
            return {
              type: 'rect',
              shape: { x: x0, y: y - h / 2, width: Math.max(2, x1 - x0), height: h, r: 2 },
              style: {
                fill: theme.sleep[api.value(3)],
                opacity: api.value(4) ? ONGOING_OPACITY : 1,
                stroke: theme.surface,
                lineWidth: 1,
              },
            }
          },
        },
      ],
    }),
    [data, theme, cutoffMinutes, maxH],
  )
  return (
    <EChart option={option} height={Math.max(150, data.days.length * 20 + 40)} label="日ごとの睡眠の時間帯" />
  )
}

/** 気分と睡眠:上に気分の点と線、下に睡眠時間の棒。日付の位置をそろえる */
export function MoodSleepChart({ data, theme }: { data: PeriodChartData; theme: ChartTheme }) {
  const option = useMemo<ChartOption>(() => {
    const n = data.days.length
    const left = 40
    const right = 12
    return {
      animation: false,
      tooltip: tooltip(theme),
      grid: [
        { left, right, top: 22, height: 120 },
        { left, right, top: 190, height: 90 },
      ],
      xAxis: [
        {
          gridIndex: 0,
          type: 'value',
          min: 0,
          max: n,
          interval: 1,
          axisLabel: { show: false },
          axisTick: { show: false },
          axisLine: { show: false },
          splitLine: { lineStyle: { color: theme.grid } },
        },
        {
          gridIndex: 1,
          type: 'category',
          data: data.days.map(shortDay),
          axisLabel: baseText(theme),
          axisTick: { show: false },
          axisLine: { lineStyle: { color: theme.grid } },
        },
      ],
      yAxis: [
        {
          gridIndex: 0,
          type: 'value',
          min: -3,
          max: 3,
          interval: 1,
          name: '気分',
          nameTextStyle: { ...baseText(theme), align: 'right' },
          axisLabel: { ...baseText(theme), formatter: (v: number) => (v > 0 ? `+${v}` : `${v}`) },
          splitLine: { lineStyle: { color: theme.grid } },
        },
        {
          gridIndex: 1,
          type: 'value',
          min: 0,
          minInterval: 1,
          name: '睡眠(時間)',
          nameTextStyle: { ...baseText(theme), align: 'left' },
          axisLabel: baseText(theme),
          splitLine: { lineStyle: { color: theme.grid } },
        },
      ],
      series: [
        {
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: data.moodPoints.map((p) => ({
            value: [p.x, p.value],
            tip: `${formatJst(p.at, 'M/d H:mm')}<br/>気分 ${p.value > 0 ? '+' : ''}${p.value}`,
          })),
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 2, color: theme.mood },
          itemStyle: { color: theme.mood, borderColor: theme.surface, borderWidth: 2 },
          tooltip: { formatter: (p: { data: { tip: string } }) => p.data.tip },
        },
        {
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          barMaxWidth: 28,
          data: data.totalMinutes.map((m, i) =>
            m === null
              ? null
              : {
                  value: +(m / 60).toFixed(2),
                  tip: `${formatDayLabel(data.days[i])}<br/>睡眠 合計${formatMinutes(m)}`,
                },
          ),
          itemStyle: { color: theme.total, borderRadius: [2, 2, 0, 0] },
          tooltip: { formatter: (p: { data: { tip: string } }) => p.data?.tip ?? '' },
        },
      ],
    }
  }, [data, theme])
  return <EChart option={option} height={310} label="気分と睡眠時間" />
}

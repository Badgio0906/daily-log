import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, CustomChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'

// 使う部品だけを読み込む。印刷でもくっきり出るよう SVG で描く
echarts.use([BarChart, CustomChart, LineChart, GridComponent, TooltipComponent, SVGRenderer])

export type ChartOption = echarts.EChartsCoreOption

export function EChart({ option, height, label }: { option: ChartOption; height: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const c = echarts.init(ref.current, null, { renderer: 'svg' })
    chart.current = c
    const ro = new ResizeObserver(() => c.resize())
    ro.observe(ref.current)
    const onPrint = () => c.resize()
    window.addEventListener('beforeprint', onPrint)
    return () => {
      ro.disconnect()
      window.removeEventListener('beforeprint', onPrint)
      c.dispose()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    chart.current?.setOption(option, true)
  }, [option])

  return <div ref={ref} className="echart" style={{ height }} role="img" aria-label={label} />
}

/** 端末がダークモードか */
export function useDarkMode(): boolean {
  const query = '(prefers-color-scheme: dark)'
  const [dark, setDark] = useState(() => window.matchMedia?.(query).matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const on = () => setDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return dark
}

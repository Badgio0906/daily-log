// グラフの色。回ごとの4色は、色覚の違いがあっても隣どうしを見分けられることを確かめた組み合わせ。
// 画面の CSS(--c1〜--c4)と同じ色を使う。

export interface ChartTheme {
  surface: string
  text: string
  muted: string
  grid: string
  /** 1回目・2回目・3回目・4回目以降 */
  sleep: [string, string, string, string]
  mood: string
  total: string
}

export const LIGHT: ChartTheme = {
  surface: '#ffffff',
  text: '#222222',
  muted: '#6b6b6b',
  grid: '#ecebe7',
  sleep: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'],
  mood: '#6250d6',
  total: '#9a9890',
}

export const DARK: ChartTheme = {
  surface: '#222427',
  text: '#ececec',
  muted: '#a0a0a0',
  grid: '#34363a',
  sleep: ['#3987e5', '#d95926', '#199e70', '#c98500'],
  mood: '#9085e9',
  total: '#77756f',
}

export const SLEEP_LABELS = ['1回目', '2回目', '3回目', '4回目以降']

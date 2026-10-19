import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// アイコンの元絵(public/icon.svg)から、ホーム画面用のアイコンを作る設定。
// 作り直すときは npx pwa-assets-generator を実行する。
const background = '#2f4a7a'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0.1, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
})

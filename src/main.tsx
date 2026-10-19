import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ensureInitialized } from './db/db'
import './styles.css'

const root = createRoot(document.getElementById('root')!)

// 開発中の動作確認用(公開版には含まれない)
if (import.meta.env.DEV) {
  import('./db/db').then((m) => Object.assign(window, { __dailyLog: m }))
}

ensureInitialized()
  .then(() => {
    // 端末の空き容量が少ないときに、記録が勝手に消されにくくする
    navigator.storage?.persist?.().catch(() => {})
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((e) => {
    console.error(e)
    root.render(
      <p style={{ padding: 16 }}>
        データを読み込めませんでした。Safari のプライベートブラウズでは使えません。通常の画面で開いてください。
      </p>,
    )
  })

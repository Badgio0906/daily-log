import { useState } from 'react'
import { useAppData, useNow } from './hooks'
import { ListScreen } from './screens/ListScreen'
import { ReviewScreen } from './screens/ReviewScreen'
import { TodayScreen } from './screens/TodayScreen'

type Tab = 'today' | 'review' | 'list' | 'export' | 'settings'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'today', label: 'きょう', icon: '☀' },
  { key: 'review', label: '振り返り', icon: '▤' },
  { key: 'list', label: '記録', icon: '☰' },
  { key: 'export', label: '書き出し', icon: '⇪' },
  { key: 'settings', label: '設定', icon: '⚙' },
]

export function App() {
  const data = useAppData()
  const now = useNow()
  const [tab, setTab] = useState<Tab>('today')

  if (!data) return <div className="loading">読み込み中…</div>

  return (
    <div className="app">
      <main className="main">
        {tab === 'today' && <TodayScreen data={data} now={now} onGoExport={() => setTab('export')} />}
        {tab === 'list' && <ListScreen data={data} now={now} />}
        {tab === 'review' && <ReviewScreen data={data} now={now} />}
        {(tab === 'export' || tab === 'settings') && <div className="screen"><p className="muted">準備中です</p></div>}
      </main>
      <nav className="tabbar" aria-label="画面の切り替え">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'active' : ''}`}
            aria-current={tab === t.key ? 'page' : undefined}
            onClick={() => {
              setTab(t.key)
              window.scrollTo(0, 0)
            }}
          >
            <span className="tab-icon" aria-hidden>
              {t.icon}
            </span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

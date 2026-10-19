import { setCutoff, setItemVisible } from '../db/db'
import type { AppData } from '../hooks'
import { formatCutoff } from '../logic/day'

const CUTOFF_OPTIONS = Array.from({ length: 96 }, (_, i) => i * 15)

export function SettingsScreen({ data }: { data: AppData }) {
  const cutoff = data.settings.cutoffMinutes
  return (
    <div className="screen">
      <h1>設定</h1>

      <section className="card">
        <h2>1日の区切り時刻</h2>
        <p className="muted small">
          この時刻より前の記録は、前の日の分として数えます。変えると、これまでの記録も新しい区切りで並び直ります(記録そのものは変わりません)。
        </p>
        <select
          aria-label="1日の区切り時刻"
          value={cutoff}
          onChange={(e) => setCutoff(Number(e.target.value))}
        >
          {CUTOFF_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {formatCutoff(m)}
              {m === 240 ? '(はじめの設定)' : ''}
            </option>
          ))}
        </select>
      </section>

      <section className="card">
        <h2>記録する項目</h2>
        <p className="muted small">使わない項目は隠せます。隠しても、これまでの記録とグラフには残ります。</p>
        <ul className="rows settings-items">
          {data.items.map((item) => (
            <li key={item.id}>
              <label className="row">
                <span className="row-main">
                  {item.name}
                  {item.core && <span className="muted small">(いつも表示)</span>}
                </span>
                <input
                  type="checkbox"
                  className="switch"
                  checked={item.visible}
                  disabled={item.core}
                  onChange={(e) => setItemVisible(item.id, e.target.checked)}
                  aria-label={`${item.name}を表示する`}
                />
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="card about">
        <h2>このアプリについて</h2>
        <p>医師に見せるための記録で、診断のためのアプリではありません。</p>
        <p>強く落ち込んだときは、アプリで様子を見ずに主治医や支援機関に連絡をしてください。</p>
        <p className="muted small">
          記録はこの iPhone の中だけに保存され、外には送られません。機種変更やもしものときのために、「書き出し」画面からときどきバックアップを保存してください。
        </p>
        <p className="muted small">
          ホーム画面に追加して使う場合は、必ずホーム画面のアイコンから開いてください(Safari で開いた画面とは記録が別になります)。
        </p>
      </section>
    </div>
  )
}

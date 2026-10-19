import type { ReactNode } from 'react'

/** 画面の下から出る入力用の小さな画面 */
export function Sheet({ title, onClose, children }: { title: string; onClose?: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          {onClose && (
            <button className="btn-text" onClick={onClose}>
              閉じる
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

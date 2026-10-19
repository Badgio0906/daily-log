// 書き出したファイルを、iPhone の共有シートで保存・送信する。共有シートが使えなければダウンロードする。

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

export async function shareFile(content: string, filename: string, type: string): Promise<ShareResult> {
  const file = new File([content], filename, { type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      throw e
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

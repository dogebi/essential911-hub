export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

export function formatViews(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '')}만회`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}천회`
  return `${n}회`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** @593 channel videos are mostly dated clips: fall back to a readable label. */
export function displayTitle(title: string, id: string): string {
  const trimmed = title.trim()
  const isDate = /^\d{4}年\d{1,2}月\d{1,2}日$/.test(trimmed)
  if (!trimmed || isDate) {
    const ko = trimmed.replace(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/, '$1년 $2월 $3일')
    return ko ? `${ko} 클립` : `클립 ${id}`
  }
  return trimmed
}

export function relativeDay(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days < 1) return '오늘'
  if (days < 7) return `${days}일 전`
  if (days < 30) return `${Math.floor(days / 7)}주 전`
  if (days < 365) return `${Math.floor(days / 30)}개월 전`
  return `${Math.floor(days / 365)}년 전`
}

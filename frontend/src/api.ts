import type {
  Category,
  DemoCatalog,
  HomeData,
  ListQuery,
  Tag,
  VideoCard,
  VideoDetail,
  VideoDetailData,
  VideoList,
} from './types'

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '')
const DATA_URL = `${import.meta.env.BASE_URL}data`

export type DataMode = 'api' | 'static'

let mode: DataMode = __HUB_DATA_MODE__ === 'static' ? 'static' : 'api'

export const currentMode = (): DataMode => mode

/** A snapshot build can be pointed at a live API later with VITE_API_BASE. */
export function forceApiMode() {
  if (API_BASE) mode = 'api'
}

interface Snapshot {
  home: HomeData
  videos: VideoCard[]
  categories: Category[]
  tags: Tag[]
}

let snapshotPromise: Promise<Snapshot> | null = null

function loadSnapshot(): Promise<Snapshot> {
  if (!snapshotPromise) {
    snapshotPromise = (async () => {
      const get = async (name: string) => {
        const res = await fetch(`${DATA_URL}/${name}.json`, { cache: 'no-cache' })
        if (!res.ok) throw new Error(`snapshot ${name} missing (${res.status})`)
        return res.json()
      }
      const [home, videos, categories, tags] = await Promise.all([
        get('home'),
        get('videos'),
        get('categories'),
        get('tags'),
      ])
      return { home, videos: videos.items ?? videos, categories, tags }
    })()
  }
  return snapshotPromise
}

async function requestApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

/** Try the Rust API first; fall back to the bundled snapshot when unreachable. */
async function request<T>(path: string): Promise<T> {
  if (mode === 'static') throw new Error('static-mode')
  try {
    return await requestApi<T>(path)
  } catch (err) {
    if (mode === 'api' && API_BASE === '') {
      // Same-origin API is expected; a hard network failure means this is a static host.
      const message = err instanceof Error ? err.message : String(err)
      if (message !== 'static-mode' && /Failed to fetch|NetworkError|frame|laden/i.test(message)) {
        mode = 'static'
        throw new Error('static-mode')
      }
    }
    throw err
  }
}

async function withSnapshot<T>(live: () => Promise<T>, offline: (s: Snapshot) => T): Promise<T> {
  if (mode === 'static') return offline(await loadSnapshot())
  try {
    return await live()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === 'static-mode' || /Failed to fetch|NetworkError|load failed/i.test(message)) {
      mode = 'static'
      return offline(await loadSnapshot())
    }
    throw err
  }
}

export const dataMode = currentMode

// ---------------------------------------------------------------- API surface

export function getHome(): Promise<HomeData> {
  return withSnapshot(
    () => request<HomeData>('/api/home'),
    (s) => s.home,
  )
}

export function getCategories(): Promise<Category[]> {
  return withSnapshot(
    () => request<Category[]>('/api/categories'),
    (s) => s.categories,
  )
}

export function getTags(): Promise<Tag[]> {
  return withSnapshot(
    () => request<Tag[]>('/api/tags'),
    (s) => s.tags,
  )
}

function sortStatic(items: VideoCard[], sort: ListQuery['sort']): VideoCard[] {
  const copy = [...items]
  if (sort === 'popular') return copy.sort((a, b) => b.view_count - a.view_count)
  if (sort === 'weekly') {
    return copy.sort(
      (a, b) => (b.weekly_views ?? b.view_count) - (a.weekly_views ?? a.view_count),
    )
  }
  return copy.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
}

function listFromSnapshot(s: Snapshot, q: ListQuery): VideoList {
  const limit = Math.min(Math.max(q.limit ?? 24, 1), 60)
  const offset = Math.max(q.offset ?? 0, 0)
  const needle = q.q?.trim().toLowerCase()
  let items = s.videos.filter((v) => {
    if (q.kind && q.kind !== 'all' && v.kind !== q.kind) return false
    if (q.category && !v.categories.some((c) => c.slug === q.category)) return false
    if (q.tag && !v.tags.some((t) => t.slug === q.tag)) return false
    if (needle && !v.title.toLowerCase().includes(needle)) return false
    return true
  })
  items = sortStatic(items, q.sort)
  return { total: items.length, items: items.slice(offset, offset + limit) }
}

export function getVideos(q: ListQuery = {}): Promise<VideoList> {
  const params = new URLSearchParams({ limit: String(q.limit ?? 24), offset: String(q.offset ?? 0) })
  if (q.kind && q.kind !== 'all') params.set('kind', q.kind)
  if (q.sort && q.sort !== 'latest') params.set('sort', q.sort)
  if (q.q?.trim()) params.set('q', q.q.trim())
  if (q.category) params.set('category', q.category)
  if (q.tag) params.set('tag', q.tag)

  return withSnapshot(
    () => request<VideoList>(`/api/videos?${params.toString()}`),
    (s) => listFromSnapshot(s, q),
  )
}

export function getCategoriesWithVideos(slug: string): Promise<VideoList> {
  return getVideos({ category: slug, limit: 60 })
}

export function getVideo(id: string): Promise<VideoDetailData> {
  return withSnapshot(
    () => request<VideoDetailData>(`/api/videos/${encodeURIComponent(id)}`),
    (s) => detailFromSnapshot(s, id),
  )
}

function detailFromSnapshot(s: Snapshot, id: string): VideoDetailData {
  const card = s.videos.find((v) => v.id === id)
  if (!card) throw new Error('video not found')
  const catSlugs = new Set(card.categories.map((c) => c.slug))
  const tagSlugs = new Set(card.tags.map((t) => t.slug))

  const related = s.videos
    .filter((v) => v.id !== id && v.categories.some((c) => catSlugs.has(c.slug)))
    .slice(0, 8)

  const graph = s.videos
    .filter((v) => v.id !== id && v.tags.some((t) => tagSlugs.has(t.slug)))
    .map((v) => ({ v, shared: v.tags.filter((t) => tagSlugs.has(t.slug)).length }))
    .sort((a, b) => b.shared - a.shared || b.v.view_count - a.v.view_count)
    .slice(0, 6)
    .map((x) => x.v)

  const video: VideoDetail = {
    ...card,
    description: (card as VideoDetail).description ?? '',
    youtube_url: `https://www.youtube.com/watch?v=${card.id}`,
    embed_url: `https://www.youtube.com/embed/${card.id}?rel=0`,
  }
  return { video, related, graph_related: graph }
}

// ---------------------------------------------------------------- aimotion demos

let demoPromise: Promise<DemoCatalog> | null = null

/**
 * The aimotion demo catalog is a pure static asset (`data/aimotion.json`), so it is
 * served the same way in API and static mode — no Rust endpoint required.
 */
export function getDemos(): Promise<DemoCatalog> {
  if (!demoPromise) {
    demoPromise = (async () => {
      const res = await fetch(`${DATA_URL}/aimotion.json`, { cache: 'no-cache' })
      if (!res.ok) throw new Error(`demo catalog missing (${res.status})`)
      const catalog = (await res.json()) as DemoCatalog
      catalog.groups.sort((a, b) => a.sort_order - b.sort_order)
      return catalog
    })()
  }
  return demoPromise
}

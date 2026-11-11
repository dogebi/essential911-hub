export interface CatRef {
  slug: string
  name: string
}

export interface VideoCard {
  id: string
  title: string
  published_at: string
  duration_seconds: number
  kind: 'short' | 'long'
  thumbnail_url: string
  view_count: number
  like_count: number
  weekly_views?: number
  categories: CatRef[]
  tags: CatRef[]
}

export interface VideoDetail extends VideoCard {
  description: string
  youtube_url: string
  embed_url: string
}

export interface Category {
  slug: string
  name: string
  description: string
  video_count: number
}

export interface Tag {
  slug: string
  name: string
  video_count: number
}

export interface CategoryBlock extends Category {
  videos: VideoCard[]
}

export interface HomeData {
  total_videos: number
  popular: VideoCard[]
  rows: CategoryBlock[]
  tags: Tag[]
}

export interface VideoList {
  items: VideoCard[]
  total: number
}

export interface VideoDetailData {
  video: VideoDetail
  related: VideoCard[]
  graph_related: VideoCard[]
}

export type KindFilter = 'all' | 'short' | 'long'
export type SortFilter = 'latest' | 'weekly' | 'popular'

// ---------------------------------------------------------------- aimotion demos
// 166 short web-graphics demos published at <site>/<id>/ — static snapshot only
// (frontend/public/data/aimotion.json), independent of the video API.

export interface DemoItem {
  id: string
  number: number
  title: string
  tech: string
  group: string
  group_name: string
  tags: string[]
  libraries: string[]
  points: string[]
  scene: string
  live_url: string
  poster_url: string
  notes_url: string
}

export interface DemoGroup {
  slug: string
  name: string
  description: string
  sort_order: number
  demo_count: number
}

export interface DemoTag {
  slug: string
  name: string
  demo_count: number
}

export interface DemoCatalog {
  site: string
  repo: string
  generated_at: string
  count: number
  group_count: number
  groups: DemoGroup[]
  tags: DemoTag[]
  demos: DemoItem[]
}

export interface ListQuery {
  limit?: number
  offset?: number
  kind?: KindFilter
  sort?: SortFilter
  q?: string
  category?: string
  tag?: string
}

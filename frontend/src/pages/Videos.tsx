import { useEffect, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import * as api from '../api'
import { CategorySwitch, SkeletonGrid, VideoCardView } from '../components'
import type { KindFilter, SortFilter } from '../types'

const KINDS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'short', label: '쇼츠' },
  { value: 'long', label: '롱폼' },
]

const SORTS: { value: SortFilter; label: string }[] = [
  { value: 'latest', label: '최신순' },
  { value: 'weekly', label: '이번 주 인기' },
  { value: 'popular', label: '누적 인기순' },
]

export default function VideosPage() {
  const [params, setParams] = useSearchParams()
  const kind = (KINDS.find((k) => k.value === params.get('kind'))?.value ?? 'all') as KindFilter
  const sort = (SORTS.find((s) => s.value === params.get('sort'))?.value ?? 'latest') as SortFilter
  const q = params.get('q') ?? ''
  const [searchInput, setSearchInput] = useState(q)

  useEffect(() => setSearchInput(q), [q])

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: api.getCategories })

  const update = (key: string, value: string, def: string) => {
    const next = new URLSearchParams(params)
    if (value === def) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const query = { kind, sort, q }
  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['videos', query],
    queryFn: ({ pageParam }) => api.getVideos({ ...query, offset: pageParam, limit: 24 }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.length * 24
      return loaded < last.total ? loaded : undefined
    },
  })

  const items = data?.pages.flatMap((p) => p.items) ?? []
  const total = data?.pages[0]?.total

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="crumb">홈 › 전체 영상</p>
          <h1>{q ? `“${q}” 검색 결과` : '전체 영상'}</h1>
          <p>쇼츠와 롱폼을 한 곳에서. 종류와 정렬을 바꿔 볼 수 있습니다.</p>
          <form
            className="search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              update('q', searchInput.trim(), '')
            }}
          >
            <input
              type="search"
              value={searchInput}
              maxLength={100}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="영상 검색 (예: 그림, 짜장면, 데모)"
              aria-label="영상 검색"
            />
            <button type="submit">검색</button>
          </form>
        </div>
      </section>

      <div className="container page-body">
        {categories && <div style={{ marginBottom: 24 }}><CategorySwitch categories={categories} /></div>}

        <div className="toolbar">
          <div className="seg" role="tablist" aria-label="영상 종류">
            {KINDS.map((k) => (
              <button
                key={k.value}
                role="tab"
                aria-selected={kind === k.value}
                className={kind === k.value ? 'on' : ''}
                onClick={() => update('kind', k.value, 'all')}
              >
                {k.label}
              </button>
            ))}
          </div>
          <div className="toolbar-right">
            {total !== undefined && <span className="count">{total}편</span>}
            <select
              value={sort}
              onChange={(e) => update('sort', e.target.value, 'latest')}
              aria-label="정렬"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isPending && <SkeletonGrid />}
        {isError && (
          <div className="empty">
            <p>영상 목록을 불러오지 못했습니다.</p>
            <button className="btn-ghost" onClick={() => refetch()}>
              다시 시도
            </button>
          </div>
        )}
        {!isPending && !isError && items.length === 0 && (
          <div className="empty">
            <p>조건에 맞는 영상이 없습니다.</p>
          </div>
        )}

        <div className="grid">
          {items.map((v) => (
            <VideoCardView key={v.id} v={v} />
          ))}
        </div>

        {hasNextPage && (
          <div className="more">
            <button className="btn-ghost" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? '불러오는 중…' : '더 보기'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

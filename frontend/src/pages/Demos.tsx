import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import * as api from '../api'
import { SkeletonGrid } from '../components'
import type { DemoCatalog, DemoGroup, DemoItem } from '../types'

/** 카드 한 장 — 허브 안의 상세 화면(/demo/:id)에서 데모를 재생한다. */
function DemoCard({ d, tagNames }: { d: DemoItem; tagNames: Map<string, string> }) {
  return (
    <Link
      className="demo-card"
      to={`/demo/${d.id}`}
      data-testid="demo-card"
      title={`${d.title} — ${d.tech}`}
      aria-label={`${d.title} 데모 재생`}
    >
      <div className="demo-poster">
        {d.poster_url ? (
          <img src={d.poster_url} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="demo-noposter" aria-hidden="true" />
        )}
        <span className="demo-num">{String(d.number).padStart(2, '0')}</span>
        <span className="demo-play" aria-hidden="true">
          ▶
        </span>
      </div>
      <div className="demo-body">
        <strong className="demo-title">{d.title}</strong>
        <p className="demo-tech">{d.tech}</p>
        <div className="demo-tags">
          {d.tags.slice(0, 3).map((slug) => (
            <span key={slug} className="demo-tag">
              #{tagNames.get(slug) ?? slug}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}

function SectionHead({ catalog, group }: { catalog: DemoCatalog; group?: DemoGroup }) {
  return (
    <section className="page-hero">
      <div className="container">
        <p className="crumb">
          <Link to="/">홈</Link> › <Link to="/demos">데모 라이브러리</Link>
          {group && <> › {group.name}</>}
        </p>
        <h1>{group ? group.name : 'aimotion 데모 라이브러리'}</h1>
        <p>
          {group
            ? group.description
            : '웹 기술로 그래픽을 그리는 방법을 기법 하나당 짧은 데모 하나로 구현했습니다. 카드를 누르면 데모가 바로 재생됩니다.'}
        </p>
        <p className="demo-stats">
          총 <b>{catalog.count}</b>편 · <b>{catalog.group_count}</b>개 분류 · 태그{' '}
          <b>{catalog.tags.length}</b>개 ·{' '}
          <a href={catalog.site} target="_blank" rel="noreferrer">
            전체 화면으로 보기 ↗
          </a>
        </p>
      </div>
    </section>
  )
}

export default function DemosPage() {
  const { group: groupSlug } = useParams()
  const [params, setParams] = useSearchParams()
  const activeTag = params.get('tag') ?? ''
  const q = params.get('q') ?? ''
  const [searchInput, setSearchInput] = useState(q)

  useEffect(() => setSearchInput(q), [q])

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['aimotion'],
    queryFn: api.getDemos,
  })

  const tagNames = useMemo(
    () => new Map((data?.tags ?? []).map((t) => [t.slug, t.name])),
    [data],
  )

  const group = data?.groups.find((g) => g.slug === groupSlug)

  const items = useMemo(() => {
    const all = data?.demos ?? []
    const needle = q.trim().toLowerCase()
    return all.filter((d) => {
      if (groupSlug && d.group !== groupSlug) return false
      if (activeTag && !d.tags.includes(activeTag)) return false
      if (needle) {
        const hay = [d.title, d.tech, d.group_name, ...d.tags, ...d.libraries]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [data, groupSlug, activeTag, q])

  // 태그 수는 지금 범위(분류) 안에서 다시 센다 — 전체 수와 섞이면 오해를 부른다.
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of data?.demos ?? []) {
      if (groupSlug && d.group !== groupSlug) continue
      for (const t of d.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return (data?.tags ?? [])
      .map((t) => ({ ...t, demo_count: counts.get(t.slug) ?? 0 }))
      .filter((t) => t.demo_count > 0)
  }, [data, groupSlug])

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const groupHref = (slug?: string) => {
    const base = slug ? `/demos/${slug}` : '/demos'
    const next = new URLSearchParams()
    if (activeTag) next.set('tag', activeTag)
    if (q) next.set('q', q)
    const qs = next.toString()
    return qs ? `${base}?${qs}` : base
  }

  return (
    <>
      {data && <SectionHead catalog={data} group={group} />}

      <div className="container page-body">
        {isPending && <SkeletonGrid count={8} />}

        {isError && (
          <div className="empty">
            <p>데모 목록을 불러오지 못했습니다.</p>
            <button className="btn-ghost" onClick={() => refetch()}>
              다시 시도
            </button>
          </div>
        )}

        {data && (
          <>
            <form
              className="search demo-search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault()
                setParam('q', searchInput.trim())
              }}
            >
              <input
                type="search"
                value={searchInput}
                maxLength={60}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="데모 찾기 (예: 셰이더, 타이포, GSAP, 오로라)"
                aria-label="데모 검색"
              />
              <button type="submit">검색</button>
            </form>

            <div className="demo-filters">
              <div className="cat-switch" aria-label="분류">
                <Link to={groupHref()} className={groupSlug ? '' : 'on'}>
                  전체<span className="n">{data.count}</span>
                </Link>
                {data.groups.map((g) => (
                  <Link
                    key={g.slug}
                    to={groupHref(g.slug)}
                    className={groupSlug === g.slug ? 'on' : ''}
                  >
                    {g.name}
                    <span className="n">{g.demo_count}</span>
                  </Link>
                ))}
              </div>

              <div className="demo-tagbar">
                <span className="demo-tagbar-label">태그</span>
                <ul className="chips">
                  <li>
                    <button
                      type="button"
                      className={activeTag ? 'chip' : 'chip on'}
                      onClick={() => setParam('tag', '')}
                    >
                      전체
                    </button>
                  </li>
                  {tagCounts.map((t) => (
                    <li key={t.slug}>
                      <button
                        type="button"
                        className={activeTag === t.slug ? 'chip on' : 'chip'}
                        onClick={() => setParam('tag', activeTag === t.slug ? '' : t.slug)}
                      >
                        #{t.name}
                        <span className="chip-n">{t.demo_count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="toolbar demo-toolbar">
              <span className="count">
                {items.length}편
                {activeTag && ` · #${tagNames.get(activeTag) ?? activeTag}`}
                {q && ` · “${q}”`}
              </span>
              {(activeTag || q) && (
                <button type="button" className="btn-ghost" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                  필터 초기화
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="empty">
                <p>조건에 맞는 데모가 없습니다.</p>
              </div>
            ) : (
              <div className="demo-grid">
                {items.map((d) => (
                  <DemoCard key={d.id} d={d} tagNames={tagNames} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

import { useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from './api'
import { displayTitle, formatDuration, formatViews, relativeDay } from './format'
import type { Category, Tag, VideoCard } from './types'

export const CHANNEL_URL = 'https://www.youtube.com/@essential911'
export const SITE_NAME = '북유모 허브'
export const CHANNEL_NAME = '북유모'

export function TopBar() {
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: api.getCategories })
  const { data: demos } = useQuery({ queryKey: ['aimotion'], queryFn: api.getDemos })

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand" aria-label={`${SITE_NAME} 홈`}>
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="brand-name">{CHANNEL_NAME}</span>
        </Link>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            홈
          </NavLink>
          <div className="nav-drop">
            <button type="button">카테고리 ▾</button>
            <div className="drop">
              {(categories ?? []).map((c) => (
                <Link key={c.slug} to={`/c/${c.slug}`}>
                  {c.name}
                  <span>{c.video_count}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="nav-drop">
            <button type="button">데모 ▾</button>
            <div className="drop drop-tall">
              <Link to="/demos">
                전체 데모
                <span>{demos?.count ?? 166}</span>
              </Link>
              {(demos?.groups ?? []).map((g) => (
                <Link key={g.slug} to={`/demos/${g.slug}`}>
                  {g.name}
                  <span>{g.demo_count}</span>
                </Link>
              ))}
            </div>
          </div>
          <NavLink to="/tags" className={({ isActive }) => (isActive ? 'active' : '')}>
            태그
          </NavLink>
          <NavLink to="/videos" className={({ isActive }) => (isActive ? 'active' : '')}>
            전체 영상
          </NavLink>
        </nav>
        <a className="btn-sub" href={CHANNEL_URL} target="_blank" rel="noreferrer">
          구독하기
        </a>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <p>
          {CHANNEL_NAME}는 짧게 만들고 바로 올리는 실험 기록을 담는 채널입니다. 이 사이트는 그
          영상을 카테고리·태그로 찾아보는 허브입니다.
        </p>
        <nav>
          <Link to="/">홈</Link>
          <Link to="/tags">태그</Link>
          <Link to="/videos">전체 영상</Link>
          <Link to="/demos">데모 166편</Link>
          <a href={CHANNEL_URL} target="_blank" rel="noreferrer">
            YouTube
          </a>
        </nav>
        <p className="privacy">
          영상 정보·썸네일은 YouTube 공개 데이터를 사용하며, 모든 영상의 저작권은 원저작자에게
          있습니다. 재생은 YouTube 임베드 플레이어로 이루어집니다.
        </p>
        <p className="copy">
          © {new Date().getFullYear()} {CHANNEL_NAME}
        </p>
      </div>
    </footer>
  )
}

export function VideoCardView({
  v,
  showCategory = true,
}: {
  v: VideoCard
  showCategory?: boolean
}) {
  const weekly = v.weekly_views
  const cat = v.categories[0]
  return (
    <Link to={`/v/${v.id}`} className="card" data-testid="video-card">
      <div className="thumb">
        <img
          src={v.thumbnail_url}
          alt=""
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget
            if (!img.dataset.fallback) {
              img.dataset.fallback = '1'
              img.src = `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`
            }
          }}
        />
        <span className="badge-time">{formatDuration(v.duration_seconds)}</span>
        {v.kind === 'short' && <span className="badge-kind">쇼츠</span>}
      </div>
      <div className="card-body">
        {showCategory && cat && <span className="card-cat">{cat.name}</span>}
        <h3 className="card-title">{displayTitle(v.title, v.id)}</h3>
        <p className="card-meta">
          {weekly === undefined ? (
            <>조회 {formatViews(v.view_count)}</>
          ) : (
            <>
              최근 7일 <b>{formatViews(weekly)}</b>
            </>
          )}{' '}
          · {relativeDay(v.published_at)}
        </p>
      </div>
    </Link>
  )
}

export function Row({
  title,
  subtitle,
  moreTo,
  videos,
  showCategory,
  extra,
}: {
  title: string
  subtitle?: string
  moreTo?: string
  videos: VideoCard[]
  showCategory?: boolean
  extra?: React.ReactNode
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const scrollBy = (dir: number) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.92, behavior: 'smooth' })
  }

  return (
    <section className="row">
      <div className="row-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="row-ctrl">
          {extra}
          {moreTo && (
            <Link to={moreTo} className="more-link">
              모두보기
            </Link>
          )}
          <button className="arrow" onClick={() => scrollBy(-1)} aria-label="이전">
            ‹
          </button>
          <button className="arrow" onClick={() => scrollBy(1)} aria-label="다음">
            ›
          </button>
        </div>
      </div>
      <div className="row-track" ref={trackRef}>
        {videos.map((v) => (
          <div className="row-item" key={v.id}>
            <VideoCardView v={v} showCategory={showCategory} />
          </div>
        ))}
      </div>
    </section>
  )
}

export function SearchBox({ initial = '', big = false }: { initial?: string; big?: boolean }) {
  const [value, setValue] = useState(initial)
  const navigate = useNavigate()
  return (
    <form
      className={big ? 'search search-big' : 'search'}
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const q = value.trim()
        navigate(q ? `/videos?q=${encodeURIComponent(q)}` : '/videos')
      }}
    >
      <input
        type="search"
        value={value}
        maxLength={100}
        onChange={(e) => setValue(e.target.value)}
        placeholder="영상 검색 (예: 그림, 짜장면, 데모)"
        aria-label="영상 검색"
      />
      <button type="submit">검색</button>
    </form>
  )
}

export function TagChips({ tags, counts }: { tags: Tag[]; counts?: boolean }) {
  return (
    <ul className="chips">
      {tags.map((t) => (
        <li key={t.slug}>
          <Link to={`/t/${t.slug}`} className="chip">
            #{t.name}
            {counts && t.video_count !== undefined && (
              <span className="chip-n">{t.video_count}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function CategorySwitch({
  categories,
  active,
}: {
  categories: Category[]
  active?: string
}) {
  return (
    <div className="cat-switch">
      <Link to="/videos" className={active ? '' : 'on'}>
        전체
      </Link>
      {categories.map((c) => (
        <Link key={c.slug} to={`/c/${c.slug}`} className={active === c.slug ? 'on' : ''}>
          {c.name}
          <span className="n">{c.video_count}</span>
        </Link>
      ))}
    </div>
  )
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid">
      {Array.from({ length: count }, (_, i) => (
        <div className="skeleton" key={i} />
      ))}
    </div>
  )
}

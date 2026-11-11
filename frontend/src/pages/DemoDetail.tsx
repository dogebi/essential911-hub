import { useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import * as api from '../api'
import { SkeletonGrid } from '../components'

export default function DemoDetailPage() {
  const { id } = useParams()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const { data, isPending } = useQuery({ queryKey: ['aimotion'], queryFn: api.getDemos })

  const demo = useMemo(() => data?.demos.find((d) => d.id === id), [data, id])
  const tagNames = useMemo(
    () => new Map((data?.tags ?? []).map((t) => [t.slug, t.name])),
    [data],
  )
  const related = useMemo(
    () => (data?.demos ?? []).filter((d) => d.id !== id && d.group === demo?.group).slice(0, 6),
    [data, id, demo],
  )

  if (isPending) {
    return (
      <div className="container page-body">
        <SkeletonGrid count={4} />
      </div>
    )
  }

  if (!demo) {
    return (
      <div className="container page-body">
        <div className="empty">
          <p>데모를 찾을 수 없습니다.</p>
          <Link to="/demos" className="btn-ghost">
            데모 라이브러리로
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container page-body">
      <p className="crumb">
        <Link to="/">홈</Link> › <Link to="/demos">데모 라이브러리</Link> ›{' '}
        <Link to={`/demos/${demo.group}`}>{demo.group_name}</Link> › {demo.title}
      </p>

      <div className="demo-detail">
        <div>
          <div className="demo-frame">
            <iframe
              ref={frameRef}
              src={demo.live_url}
              title={`${demo.title} — ${demo.tech}`}
              allow="autoplay; fullscreen; encrypted-media"
              data-testid="demo-frame"
            />
          </div>
          <p className="demo-hint">
            데모 안에서 클릭 = 재생/멈춤 · ←/→ = ±0.5초 · H = 재생 막대 숨기기 · 주소 끝에{' '}
            <code>?t=3.2</code> 를 붙이면 그 시각부터 시작합니다.
          </p>
        </div>

        <div className="demo-info">
          <span className="demo-num-lg">
            DEMO {String(demo.number).padStart(2, '0')} · {demo.group_name}
          </span>
          <h1>{demo.title}</h1>
          <p className="demo-tech-lg">{demo.tech}</p>

          <div className="demo-pills">
            <Link className="cat-pill" to={`/demos/${demo.group}`}>
              {demo.group_name}
            </Link>
            {demo.libraries.map((lib) => (
              <span className="demo-pill" key={lib}>
                {lib}
              </span>
            ))}
          </div>

          <div className="demo-tags-lg">
            {demo.tags.map((slug) => (
              <Link className="demo-tag" key={slug} to={`/demos?tag=${slug}`}>
                #{tagNames.get(slug) ?? slug}
              </Link>
            ))}
          </div>

          {demo.points.length > 0 && (
            <div className="demo-points">
              <h2>배울 점</h2>
              <ul>
                {demo.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {demo.scene && (
            <div className="desc">
              <p>{demo.scene}</p>
            </div>
          )}

          <div className="demo-actions">
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                const frame = frameRef.current
                if (frame?.requestFullscreen) void frame.requestFullscreen()
                else window.open(demo.live_url, '_blank', 'noopener')
              }}
            >
              전체 화면
            </button>
            <a className="btn-ghost" href={demo.live_url} target="_blank" rel="noreferrer">
              새 탭에서 열기 ↗
            </a>
            <a className="btn-ghost" href={demo.notes_url} target="_blank" rel="noreferrer">
              구현 노트 ↗
            </a>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="demo-related">
          <h2>같은 분류의 다른 데모</h2>
          <div className="demo-grid">
            {related.map((d) => (
              <Link key={d.id} className="demo-card" to={`/demo/${d.id}`} data-testid="demo-related-card">
                <div className="demo-poster">
                  {d.poster_url ? <img src={d.poster_url} alt="" loading="lazy" /> : <span className="demo-noposter" />}
                  <span className="demo-num">{String(d.number).padStart(2, '0')}</span>
                </div>
                <div className="demo-body">
                  <strong className="demo-title">{d.title}</strong>
                  <p className="demo-tech">{d.tech}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

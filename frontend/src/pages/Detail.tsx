import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import * as api from '../api'
import { Row, TagChips, VideoCardView } from '../components'
import { displayTitle, formatDate, formatDuration, formatViews } from '../format'

export default function DetailPage() {
  const { id = '' } = useParams()
  const [descOpen, setDescOpen] = useState(false)
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['video', id],
    queryFn: () => api.getVideo(id),
  })

  if (isPending) {
    return (
      <div className="container page-body">
        <div className="skeleton" style={{ height: 520 }} />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="empty">
        <p>영상을 불러오지 못했습니다.</p>
        <button className="btn-ghost" onClick={() => refetch()}>
          다시 시도
        </button>
      </div>
    )
  }

  const { video, related, graph_related } = data
  const isShort = video.kind === 'short'
  const title = displayTitle(video.title, video.id)

  return (
    <>
      <div className="container">
        <article className={`detail ${isShort ? 'detail-short' : ''}`}>
          <p className="crumb">
            <Link to="/">홈</Link>
            {video.categories[0] && (
              <>
                {' › '}
                <Link to={`/c/${video.categories[0].slug}`}>{video.categories[0].name}</Link>
              </>
            )}
          </p>

          <div className="player">
            <iframe
              src={video.embed_url}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            />
          </div>

          <h1>{title}</h1>
          <p className="detail-meta">
            {isShort ? '쇼츠' : '롱폼'} · {formatDuration(video.duration_seconds)} · 조회{' '}
            {formatViews(video.view_count)} · 좋아요 {video.like_count} ·{' '}
            {formatDate(video.published_at)}
          </p>

          <div className="detail-cats">
            {video.categories.map((c) => (
              <Link key={c.slug} to={`/c/${c.slug}`} className="cat-pill">
                {c.name}
              </Link>
            ))}
            <a
              className="btn-yt"
              href={video.youtube_url}
              target="_blank"
              rel="noreferrer"
            >
              유튜브에서 보기 ↗
            </a>
          </div>

          {video.tags.length > 0 && <TagChips tags={video.tags.map((t) => ({ ...t, video_count: 0 }))} />}

          {video.description.trim() && (
            <div className={`desc ${descOpen ? 'open' : ''}`}>
              <p>{video.description}</p>
              <button type="button" onClick={() => setDescOpen((v) => !v)}>
                {descOpen ? '접기' : '설명 더 보기'}
              </button>
            </div>
          )}
        </article>
      </div>

      {related.length > 0 && (
        <div className="container">
          <Row
            title="같은 카테고리 영상"
            subtitle="비슷한 소재를 골라 이어 볼 수 있습니다."
            videos={related}
          />
        </div>
      )}

      {graph_related.length > 0 && (
        <section className="band">
          <div className="container graph-rel">
            <div className="row-head">
              <h2>태그로 이어진 영상</h2>
            </div>
            <div className="graph-grid">
              {graph_related.map((v) => (
                <VideoCardView key={v.id} v={v} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}

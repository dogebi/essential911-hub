import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import * as api from '../api'
import { SkeletonGrid, TagChips, VideoCardView } from '../components'

export default function TagPage() {
  const { slug = '' } = useParams()
  const { data: tags } = useQuery({ queryKey: ['tags'], queryFn: api.getTags })
  const tag = tags?.find((t) => t.slug === slug)
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['tag-videos', slug],
    queryFn: () => api.getVideos({ tag: slug, limit: 60 }),
  })

  return (
    <>
      <section className="page-hero page-hero-tag">
        <div className="container">
          <p className="crumb">
            <Link to="/">홈</Link> › <Link to="/tags">태그</Link>
          </p>
          <h1>#{tag?.name ?? slug}</h1>
          <p>{data ? `${data.total}편의 영상` : '태그로 모은 영상'}</p>
          {tags && (
            <TagChips
              tags={tags.filter((t) => t.slug !== slug).slice(0, 12)}
            />
          )}
        </div>
      </section>

      <div className="container page-body">
        {isPending && <SkeletonGrid />}
        {isError && (
          <div className="empty">
            <p>영상을 불러오지 못했습니다.</p>
            <button className="btn-ghost" onClick={() => refetch()}>
              다시 시도
            </button>
          </div>
        )}
        {data && data.items.length === 0 && (
          <div className="empty">
            <p>이 태그에 아직 영상이 없습니다.</p>
          </div>
        )}
        <div className="grid">
          {(data?.items ?? []).map((v) => (
            <VideoCardView key={v.id} v={v} />
          ))}
        </div>
      </div>
    </>
  )
}

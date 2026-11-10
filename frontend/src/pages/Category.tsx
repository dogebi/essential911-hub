import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import * as api from '../api'
import { CategorySwitch, SkeletonGrid, VideoCardView } from '../components'

export default function CategoryPage() {
  const { slug = '' } = useParams()
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: api.getCategories })
  const category = categories?.find((c) => c.slug === slug)
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['category-videos', slug],
    queryFn: () => api.getCategoriesWithVideos(slug),
  })

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="crumb">
            <Link to="/">홈</Link> › 카테고리
          </p>
          <h1>{category?.name ?? slug}</h1>
          <p>{category?.description ?? '카테고리별 영상 모음'}</p>
          {categories && <CategorySwitch categories={categories} active={slug} />}
        </div>
      </section>

      <div className="container page-body">
        <div className="toolbar">
          <div />
          <div className="toolbar-right">
            {data && <span className="count">{data.total}편</span>}
          </div>
        </div>

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
            <p>이 카테고리에 아직 영상이 없습니다.</p>
          </div>
        )}

        <div className="grid">
          {(data?.items ?? []).map((v) => (
            <VideoCardView key={v.id} v={v} showCategory={false} />
          ))}
        </div>
      </div>
    </>
  )
}

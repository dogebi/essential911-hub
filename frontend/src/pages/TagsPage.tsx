import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import * as api from '../api'

export default function TagsPage() {
  const { data: tags, isPending, isError, refetch } = useQuery({
    queryKey: ['tags'],
    queryFn: api.getTags,
  })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: api.getCategories })

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="crumb">
            <Link to="/">홈</Link> › 태그
          </p>
          <h1>태그 전체</h1>
          <p>같은 도구·같은 소재끼리 묶었습니다.</p>
        </div>
      </section>

      <div className="container page-body">
        {isPending && <p className="count">불러오는 중…</p>}
        {isError && (
          <div className="empty">
            <p>태그를 불러오지 못했습니다.</p>
            <button className="btn-ghost" onClick={() => refetch()}>
              다시 시도
            </button>
          </div>
        )}

        {categories && categories.length > 0 && (
          <>
            <h2 style={{ fontSize: 22, margin: '0 0 16px' }}>카테고리</h2>
            <ul className="chips" style={{ marginBottom: 40 }}>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link to={`/c/${c.slug}`} className="chip">
                    {c.name}
                    <span className="chip-n">{c.video_count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <h2 style={{ fontSize: 22, margin: '0 0 16px' }}>태그</h2>
        <ul className="chips">
          {(tags ?? []).map((t) => (
            <li key={t.slug}>
              <Link to={`/t/${t.slug}`} className="chip">
                #{t.name}
                <span className="chip-n">{t.video_count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

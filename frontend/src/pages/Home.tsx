import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import * as api from '../api'
import { CHANNEL_NAME, CHANNEL_URL, Row, SearchBox, SkeletonGrid, TagChips } from '../components'

export default function HomePage() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['home'],
    queryFn: api.getHome,
  })
  const { data: demos } = useQuery({ queryKey: ['aimotion'], queryFn: api.getDemos })

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <p className="eyebrow">짧게 만들고 바로 올리는 채널 {CHANNEL_NAME}</p>
          <h1>
            만들고, 올리고, 남긴
            <br />
            영상 기록{data ? ` ${data.total_videos}편` : ''}
          </h1>
          <p className="hero-sub">
            실험은 쇼츠로, 결과는 이 허브에. 같은 소재를 다시 볼 때 찾기 쉽게 정리합니다.
            <br />
            카테고리와 태그로 골라 보세요.
          </p>
          <SearchBox big />
          <div className="hero-btns">
            <a href="#categories" className="btn-yellow">
              카테고리 둘러보기
            </a>
            <a href={CHANNEL_URL} target="_blank" rel="noreferrer" className="btn-outline">
              유튜브 채널 ↗
            </a>
          </div>
        </div>
      </section>

      {isError && (
        <div className="empty">
          <p>영상을 불러오지 못했습니다.</p>
          <button className="btn-ghost" onClick={() => refetch()}>
            다시 시도
          </button>
        </div>
      )}

      {isPending && (
        <div className="container">
          <SkeletonGrid count={4} />
        </div>
      )}

      {data && (
        <>
          <div className="container">
            <Row
              title="지금 많이 본 영상"
              subtitle="누적 조회수가 가장 높은 영상부터"
              moreTo="/videos?sort=popular"
              videos={data.popular}
            />
          </div>

          <section className="band" id="categories">
            <div className="container">
              <div className="band-head">
                <h2>카테고리별로 보기</h2>
                <p>시리즈와 주제로 나눴습니다. 영상 하나가 여러 카테고리에 들어갈 수 있어요.</p>
              </div>
              <div className="cat-grid">
                {data.rows.map((row) => (
                  <Link to={`/c/${row.slug}`} className="cat-tile" key={row.slug}>
                    <div className="cat-thumbs" aria-hidden="true">
                      {row.videos.slice(0, 3).map((v) => (
                        <img key={v.id} src={v.thumbnail_url} alt="" loading="lazy" />
                      ))}
                    </div>
                    <div className="cat-text">
                      <strong>{row.name}</strong>
                      <span className="cat-n">{row.video_count}편</span>
                      <p>{row.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="band" id="demos">
            <div className="container">
              <div className="band-head">
                <h2>aimotion 데모 라이브러리</h2>
                <p>
                  웹 그래픽 표현 기법 {demos?.count ?? 166}편을 {demos?.group_count ?? 12}개 분류와
                  태그로 정리했습니다. 카드를 누르면 데모가 바로 재생됩니다.
                </p>
              </div>
              <div className="demo-tiles">
                {(demos?.groups ?? []).map((g) => {
                  const picks = (demos?.demos ?? [])
                    .filter((d) => d.group === g.slug && d.poster_url)
                    .slice(0, 3)
                  return (
                    <Link to={`/demos/${g.slug}`} className="demo-tile" key={g.slug}>
                      <div className="demo-strip" aria-hidden="true">
                        {picks.map((d) => (
                          <img key={d.id} src={d.poster_url} alt="" loading="lazy" />
                        ))}
                        {picks.length === 0 && <span className="demo-noposter" />}
                      </div>
                      <div className="demo-tile-text">
                        <strong>{g.name}</strong>
                        <span className="demo-tile-n">{g.demo_count}편</span>
                        <p>{g.description}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
              <div className="center">
                <Link to="/demos" className="btn-outline">
                  데모 전체 보기 →
                </Link>
              </div>
            </div>
          </section>

          <div className="container">
            {data.rows.map((row) => (
              <Row
                key={row.slug}
                title={row.name}
                subtitle={row.description}
                moreTo={`/c/${row.slug}`}
                videos={row.videos}
                showCategory={false}
              />
            ))}
          </div>

          <section className="band band-dark">
            <div className="container">
              <div className="band-head">
                <h2>태그로 모아 보기</h2>
                <p>같은 소재·같은 형식끼리 묶었습니다.</p>
              </div>
              <TagChips tags={data.tags} counts />
              <div className="center">
                <Link to="/tags" className="btn-outline">
                  태그 전체 보기 →
                </Link>
              </div>
            </div>
          </section>

          <div className="container">
            <section className="cta">
              <h2>새 영상은 유튜브에서 먼저</h2>
              <p>짧은 실험 영상이 매주 올라옵니다. 허브는 그 기록을 정리하는 곳입니다.</p>
              <a href={CHANNEL_URL} target="_blank" rel="noreferrer" className="btn-white">
                채널 구독하러 가기 →
              </a>
            </section>
          </div>

          <div className="container">
            <Row
              title="최신 영상"
              subtitle="가장 최근에 올라온 영상"
              moreTo="/videos"
              videos={[...data.popular]
                .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
                .slice(0, 8)}
              showCategory
            />
          </div>
        </>
      )}
    </>
  )
}

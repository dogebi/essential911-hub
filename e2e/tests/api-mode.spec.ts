import { expect, test } from '@playwright/test'

const API = 'http://127.0.0.1:8099'

test.describe('Rust axum API contract', () => {
  test('health reports the database is up', async ({ request }) => {
    const res = await request.get(`${API}/api/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.db).toBe(true)
  })

  test('home payload carries totals, rows and tags', async ({ request }) => {
    const res = await request.get(`${API}/api/home`)
    expect(res.ok()).toBeTruthy()
    const home = await res.json()
    expect(home.total_videos).toBeGreaterThan(0)
    expect(home.popular.length).toBeGreaterThan(0)
    expect(home.rows.length).toBeGreaterThanOrEqual(4)
    for (const row of home.rows) {
      expect(row.slug).toBeTruthy()
      expect(row.video_count).toBeGreaterThan(0)
      expect(Array.isArray(row.videos)).toBeTruthy()
    }
    expect(Array.isArray(home.tags)).toBeTruthy()
  })

  test('videos list paginates, filters by kind and sorts', async ({ request }) => {
    const all = await (await request.get(`${API}/api/videos?limit=5&offset=0`)).json()
    expect(all.items.length).toBeLessThanOrEqual(5)
    expect(all.total).toBeGreaterThan(0)

    const shorts = await (await request.get(`${API}/api/videos?kind=short&limit=60`)).json()
    expect(shorts.total).toBeGreaterThan(0)
    expect(shorts.items.every((v: { kind: string }) => v.kind === 'short')).toBeTruthy()

    const longs = await (await request.get(`${API}/api/videos?kind=long&limit=60`)).json()
    expect(longs.items.every((v: { kind: string }) => v.kind === 'long')).toBeTruthy()

    const popular = await (await request.get(`${API}/api/videos?sort=popular&limit=5`)).json()
    const views = popular.items.map((v: { view_count: number }) => v.view_count)
    expect([...views].sort((a: number, b: number) => b - a)).toEqual(views)
  })

  test('search matches titles and descriptions', async ({ request }) => {
    const res = await request.get(`${API}/api/videos?q=${encodeURIComponent('그림')}&limit=60`)
    const body = await res.json()
    expect(body.total).toBeGreaterThan(0)
    for (const v of body.items) {
      expect(`${v.title}`.toLowerCase()).toContain('그림')
    }
  })

  test('categories and tags expose counts', async ({ request }) => {
    const categories = await (await request.get(`${API}/api/categories`)).json()
    expect(categories.length).toBeGreaterThanOrEqual(4)
    for (const c of categories) {
      expect(typeof c.slug).toBe('string')
      expect(c.video_count).toBeGreaterThan(0)
    }
    const tags = await (await request.get(`${API}/api/tags`)).json()
    expect(tags.length).toBeGreaterThan(0)
  })

  test('video detail returns an embeddable video plus related rows', async ({ request }) => {
    const list = await (await request.get(`${API}/api/videos?limit=1&sort=popular`)).json()
    const id = list.items[0].id
    const res = await request.get(`${API}/api/videos/${id}`)
    expect(res.ok()).toBeTruthy()
    const detail = await res.json()
    expect(detail.video.id).toBe(id)
    expect(detail.video.embed_url).toBe(`https://www.youtube.com/embed/${id}?rel=0`)
    expect(detail.video.youtube_url).toBe(`https://www.youtube.com/watch?v=${id}`)
    expect(detail.video.categories.length).toBeGreaterThan(0)
    expect(Array.isArray(detail.related)).toBeTruthy()
    expect(Array.isArray(detail.graph_related)).toBeTruthy()
    expect(detail.related.every((v: { id: string }) => v.id !== id)).toBeTruthy()
  })

  test('unknown video returns 404 with a JSON error', async ({ request }) => {
    const res = await request.get(`${API}/api/videos/does-not-exist`)
    expect(res.status()).toBe(404)
    expect((await res.json()).error).toBeTruthy()
  })
})

test.describe('React UI against the live API', () => {
  test('home renders hero total, popular row, category tiles and tags', async ({ page, request }) => {
    const home = await (await request.get(`${API}/api/home`)).json()
    await page.goto('/')

    await expect(page.locator('.hero h1')).toContainText(`${home.total_videos}편`)
    await expect(page.locator('.brand-name')).toHaveText('북유모')

    const popularCards = page.locator('.row').first().locator('[data-testid="video-card"]')
    await expect(popularCards.first()).toBeVisible()
    expect(await popularCards.count()).toBe(home.popular.length)

    await expect(page.locator('.cat-tile')).toHaveCount(home.rows.length)

    const firstTile = page.locator('.cat-tile').first()
    await expect(firstTile.locator('.cat-n')).toContainText('편')

    await expect(page.locator('.band-dark .chip').first()).toBeVisible()
  })

  test('home cards navigate to a detail page with a YouTube embed', async ({ page, request }) => {
    const home = await (await request.get(`${API}/api/home`)).json()
    const target = home.popular[0]
    await page.goto('/')
    await page.locator('.row').first().locator('[data-testid="video-card"]').first().click()

    await expect(page).toHaveURL(new RegExp(`/v/${target.id}$`))
    await expect(page.locator('.player iframe')).toHaveAttribute(
      'src',
      `https://www.youtube.com/embed/${target.id}?rel=0`,
    )
    await expect(page.locator('.detail h1')).toBeVisible()
    await expect(page.locator('.detail-meta')).toContainText('조회')
    await expect(page.locator('.detail .cat-pill').first()).toBeVisible()
    await expect(page.locator('.btn-yt')).toHaveAttribute(
      'href',
      `https://www.youtube.com/watch?v=${target.id}`,
    )
    await expect(page.locator('.row [data-testid="video-card"]').first()).toBeVisible()
  })

  test('videos page filters by kind and shows the empty state for long form', async ({ page, request }) => {
    const shorts = await (await request.get(`${API}/api/videos?kind=short&limit=60`)).json()
    const longs = await (await request.get(`${API}/api/videos?kind=long&limit=60`)).json()

    await page.goto('/videos')
    await expect(page.locator('.count')).toHaveText(`${shorts.total + longs.total}편`)
    expect(await page.locator('[data-testid="video-card"]').count()).toBeGreaterThan(0)

    await page.getByRole('tab', { name: '롱폼' }).click()
    if (longs.total === 0) {
      await expect(page.locator('.empty')).toContainText('조건에 맞는 영상이 없습니다')
      await expect(page.locator('.count')).toHaveText('0편')
    } else {
      await expect(page.locator('.count')).toHaveText(`${longs.total}편`)
    }

    await page.getByRole('tab', { name: '전체' }).click()
    await expect(page.locator('.count')).toHaveText(`${shorts.total + longs.total}편`)
  })

  test('videos page sorts by popularity and searches', async ({ page, request }) => {
    const popular = await (await request.get(`${API}/api/videos?sort=popular&limit=1`)).json()
    await page.goto('/videos?sort=popular')
    await expect(page.locator('[data-testid="video-card"]').first()).toContainText(
      popular.items[0].title.length > 20 ? popular.items[0].title.slice(0, 10) : popular.items[0].title,
    )

    const search = await (await request.get(`${API}/api/videos?q=${encodeURIComponent('그림')}&limit=60`)).json()
    await page.goto('/videos')
    await page.getByRole('searchbox', { name: '영상 검색' }).fill('그림')
    await page.getByRole('button', { name: '검색' }).click()
    await expect(page).toHaveURL(/q=/)
    await expect(page.locator('.page-hero h1')).toContainText('검색 결과')
    await expect(page.locator('.count')).toHaveText(`${search.total}편`)
  })

  test('category page lists its videos and marks the switch', async ({ page, request }) => {
    const categories = await (await request.get(`${API}/api/categories`)).json()
    const target = categories[0]
    const list = await (await request.get(`${API}/api/videos?category=${target.slug}&limit=60`)).json()

    await page.goto(`/c/${target.slug}`)
    await expect(page.locator('.page-hero h1')).toHaveText(target.name)
    await expect(page.locator('.count')).toHaveText(`${list.total}편`)
    await expect(page.locator('.cat-switch a.on')).toContainText(target.name)
    await expect(page.locator('[data-testid="video-card"]')).toHaveCount(list.total)
  })

  test('tag page lists its videos', async ({ page, request }) => {
    const tags = await (await request.get(`${API}/api/tags`)).json()
    const target = tags[0]
    const list = await (await request.get(`${API}/api/videos?tag=${target.slug}&limit=60`)).json()

    await page.goto(`/t/${target.slug}`)
    await expect(page.locator('.page-hero h1')).toContainText(target.name)
    await expect(page.locator('.page-hero p').first()).toContainText(`${list.total}편`)
    await expect(page.locator('[data-testid="video-card"]')).toHaveCount(list.total)
  })

  test('tags index links categories and tags', async ({ page }) => {
    await page.goto('/tags')
    await expect(page.locator('.page-hero h1')).toHaveText('태그 전체')
    expect(await page.locator('.chip').count()).toBeGreaterThan(0)
  })

  test('unknown route renders the not-found page', async ({ page }) => {
    await page.goto('/this-page-does-not-exist')
    await expect(page.locator('.empty')).toContainText('찾는 페이지가 없습니다')
  })

  test('navigation bar reaches every section', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: '전체 영상' }).click()
    await expect(page).toHaveURL(/\/videos$/)
    await page.getByRole('link', { name: '태그' }).click()
    await expect(page).toHaveURL(/\/tags$/)
    await page.locator('.brand').click()
    await expect(page).toHaveURL(/\/$/)
  })
})

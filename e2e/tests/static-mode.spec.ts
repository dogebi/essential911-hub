import { expect, test } from '@playwright/test'

/**
 * The GitHub Pages build ships a data snapshot under /data/*.json and never talks to
 * the Rust API. These tests prove the same UI works with zero backend.
 */
test.describe('static snapshot build (GitHub Pages mode)', () => {
  test('never calls the API', async ({ page }) => {
    const apiCalls: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/')) apiCalls.push(req.url())
    })
    await page.goto('/')
    await expect(page.locator('.hero h1')).toBeVisible()
    expect(apiCalls).toEqual([])
  })

  test('home renders from the bundled snapshot', async ({ page, request }) => {
    const snapshot = await (await request.get('/data/home.json')).json()
    await page.goto('/')
    await expect(page.locator('.hero h1')).toContainText(`${snapshot.total_videos}편`)
    await expect(page.locator('.cat-tile')).toHaveCount(snapshot.rows.length)
    await expect(page.locator('.row [data-testid="video-card"]').first()).toBeVisible()
    await expect(page.locator('.band-dark .chip').first()).toBeVisible()
  })

  test('snapshot files are all present', async ({ request }) => {
    for (const name of ['home', 'videos', 'categories', 'tags']) {
      const res = await request.get(`/data/${name}.json`)
      expect(res.status(), `data/${name}.json`).toBe(200)
    }
  })

  test('videos list, category and tag pages work offline', async ({ page, request }) => {
    const videos = await (await request.get('/data/videos.json')).json()
    await page.goto('/videos')
    await expect(page.locator('.count')).toHaveText(`${videos.total}편`)

    const categories = await (await request.get('/data/categories.json')).json()
    await page.goto(`/c/${categories[0].slug}`)
    await expect(page.locator('.page-hero h1')).toHaveText(categories[0].name)

    const tags = await (await request.get('/data/tags.json')).json()
    await page.goto(`/t/${tags[0].slug}`)
    await expect(page.locator('.page-hero h1')).toContainText(tags[0].name)
    expect(await page.locator('[data-testid="video-card"]').count()).toBeGreaterThan(0)
  })

  test('deep-linked detail page survives a reload (SPA fallback)', async ({ page, request }) => {
    const videos = await (await request.get('/data/videos.json')).json()
    const target = videos.items[0]
    await page.goto(`/v/${target.id}`)
    await expect(page.locator('.player iframe')).toHaveAttribute(
      'src',
      `https://www.youtube.com/embed/${target.id}?rel=0`,
    )
    await page.reload()
    await expect(page.locator('.player iframe')).toHaveAttribute(
      'src',
      `https://www.youtube.com/embed/${target.id}?rel=0`,
    )
  })
})

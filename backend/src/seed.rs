use axum::{extract::State, Json};
use serde::Deserialize;
use sqlx::PgPool;

const SEED_JSON: &str = include_str!("../../data/seed.json");

#[derive(Deserialize)]
struct SeedFile {
    categories: Vec<SeedCategory>,
    tags: Vec<SeedTag>,
    videos: Vec<SeedVideo>,
}

#[derive(Deserialize)]
struct SeedCategory {
    slug: String,
    name: String,
    description: String,
    sort_order: i32,
}

#[derive(Deserialize)]
struct SeedTag {
    slug: String,
    name: String,
}

#[derive(Deserialize)]
struct SeedVideo {
    id: String,
    title: String,
    description: String,
    published_at: chrono::DateTime<chrono::Utc>,
    duration_seconds: i32,
    kind: String,
    thumbnail_url: String,
    view_count: i64,
    like_count: i64,
    weekly_views: Option<i64>,
    categories: Vec<String>,
    tags: Vec<String>,
}

fn parse() -> anyhow::Result<SeedFile> {
    Ok(serde_json::from_str(SEED_JSON)?)
}

pub async fn seed_if_empty(pool: &PgPool) -> anyhow::Result<bool> {
    let count: i64 = sqlx::query_scalar("select count(*) from videos")
        .fetch_one(pool)
        .await?;
    if count > 0 {
        return Ok(false);
    }
    apply(pool).await?;
    Ok(true)
}

async fn apply(pool: &PgPool) -> anyhow::Result<()> {
    let seed = parse()?;
    let mut tx = pool.begin().await?;

    for c in &seed.categories {
        sqlx::query(
            r#"insert into categories (slug, name, description, sort_order)
               values ($1, $2, $3, $4)
               on conflict (slug) do update
                 set name = excluded.name,
                     description = excluded.description,
                     sort_order = excluded.sort_order"#,
        )
        .bind(&c.slug)
        .bind(&c.name)
        .bind(&c.description)
        .bind(c.sort_order)
        .execute(&mut *tx)
        .await?;
    }

    for t in &seed.tags {
        sqlx::query(
            r#"insert into tags (slug, name) values ($1, $2)
               on conflict (slug) do update set name = excluded.name"#,
        )
        .bind(&t.slug)
        .bind(&t.name)
        .execute(&mut *tx)
        .await?;
    }

    for v in &seed.videos {
        sqlx::query(
            r#"insert into videos (id, title, description, published_at, duration_seconds, kind,
                                   thumbnail_url, view_count, like_count, weekly_views)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               on conflict (id) do update
                 set title = excluded.title,
                     description = excluded.description,
                     published_at = excluded.published_at,
                     duration_seconds = excluded.duration_seconds,
                     kind = excluded.kind,
                     thumbnail_url = excluded.thumbnail_url,
                     view_count = excluded.view_count,
                     like_count = excluded.like_count,
                     weekly_views = excluded.weekly_views"#,
        )
        .bind(&v.id)
        .bind(&v.title)
        .bind(&v.description)
        .bind(v.published_at)
        .bind(v.duration_seconds)
        .bind(&v.kind)
        .bind(&v.thumbnail_url)
        .bind(v.view_count)
        .bind(v.like_count)
        .bind(v.weekly_views)
        .execute(&mut *tx)
        .await?;

        sqlx::query("delete from video_categories where video_id = $1")
            .bind(&v.id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("delete from video_tags where video_id = $1")
            .bind(&v.id)
            .execute(&mut *tx)
            .await?;

        for slug in &v.categories {
            sqlx::query(
                r#"insert into video_categories (video_id, category_id)
                   select $1, id from categories where slug = $2
                   on conflict do nothing"#,
            )
            .bind(&v.id)
            .bind(slug)
            .execute(&mut *tx)
            .await?;
        }
        for slug in &v.tags {
            sqlx::query(
                r#"insert into video_tags (video_id, tag_id)
                   select $1, id from tags where slug = $2
                   on conflict do nothing"#,
            )
            .bind(&v.id)
            .bind(slug)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;
    Ok(())
}

/// POST /api/reseed — re-apply the bundled snapshot (idempotent upsert).
pub async fn reseed(State(pool): State<PgPool>) -> axum::response::Result<Json<serde_json::Value>> {
    match apply(&pool).await {
        Ok(()) => {
            let n: i64 = sqlx::query_scalar("select count(*) from videos")
                .fetch_one(&pool)
                .await
                .unwrap_or(0);
            Ok(Json(serde_json::json!({ "ok": true, "videos": n })))
        }
        Err(e) => {
            tracing::error!("reseed failed: {e}");
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR.into())
        }
    }
}

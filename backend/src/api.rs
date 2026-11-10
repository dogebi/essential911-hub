use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

use crate::models::*;

pub type ApiResult = Result<Json<serde_json::Value>, ApiError>;

pub struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    pub fn not_found(msg: &str) -> Self {
        Self { status: StatusCode::NOT_FOUND, message: msg.to_string() }
    }
    pub fn internal(e: impl std::fmt::Display) -> Self {
        tracing::error!("api error: {e}");
        Self { status: StatusCode::INTERNAL_SERVER_ERROR, message: "internal error".to_string() }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        (self.status, Json(serde_json::json!({ "error": self.message }))).into_response()
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(e: sqlx::Error) -> Self {
        ApiError::internal(e)
    }
}

/// Shared SELECT that materialises each video with its categories and tags.
const VIDEO_SELECT: &str = r#"
select v.id,
       v.title,
       v.description,
       v.published_at,
       v.duration_seconds,
       v.kind,
       v.thumbnail_url,
       v.view_count,
       v.like_count,
       v.weekly_views,
       coalesce((
           select json_agg(json_build_object('slug', c.slug, 'name', c.name) order by c.sort_order, c.name)
           from video_categories vc join categories c on c.id = vc.category_id
           where vc.video_id = v.id), '[]'::json) as categories,
       coalesce((
           select json_agg(json_build_object('slug', t.slug, 'name', t.name) order by t.name)
           from video_tags vt join tags t on t.id = vt.tag_id
           where vt.video_id = v.id), '[]'::json) as tags
from videos v
"#;

pub async fn health(State(pool): State<PgPool>) -> impl IntoResponse {
    match sqlx::query("select 1").execute(&pool).await {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!({ "status": "ok", "db": true })),
        ),
        Err(e) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "status": "degraded", "db": false, "error": e.to_string() })),
        ),
    }
}

async fn popular_videos(pool: &PgPool, limit: i64) -> Result<Vec<VideoCard>, sqlx::Error> {
    let sql = format!(
        "{VIDEO_SELECT} order by v.weekly_views desc nulls last, v.view_count desc limit $1"
    );
    let rows: Vec<VideoRow> = sqlx::query_as(&sql).bind(limit).fetch_all(pool).await?;
    Ok(rows.into_iter().map(VideoCard::from).collect())
}

pub async fn home(State(pool): State<PgPool>) -> Result<Json<HomeResponse>, ApiError> {
    let total: i64 = sqlx::query_scalar("select count(*) from videos").fetch_one(&pool).await?;
    let popular = popular_videos(&pool, 8).await?;

    let cats: Vec<CategoryRow> = sqlx::query_as(
        r#"
        select c.slug, c.name, c.description, count(vc.video_id) as video_count
        from categories c
        join video_categories vc on vc.category_id = c.id
        group by c.id
        order by c.sort_order asc, c.name asc
        "#,
    )
    .fetch_all(&pool)
    .await?;

    let mut rows = Vec::with_capacity(cats.len());
    for cat in cats {
        let sql = format!(
            "{VIDEO_SELECT} join video_categories vc on vc.video_id = v.id \
             join categories c on c.id = vc.category_id \
             where c.slug = $1 order by v.published_at desc limit 10"
        );
        let vids: Vec<VideoRow> = sqlx::query_as(&sql).bind(&cat.slug).fetch_all(&pool).await?;
        rows.push(CategoryBlock {
            category: cat,
            videos: vids.into_iter().map(VideoCard::from).collect(),
        });
    }

    let tags: Vec<TagRow> = sqlx::query_as(
        r#"
        select t.slug, t.name, count(vt.video_id) as video_count
        from tags t join video_tags vt on vt.tag_id = t.id
        group by t.id order by video_count desc, t.name asc limit 24
        "#,
    )
    .fetch_all(&pool)
    .await?;

    Ok(Json(HomeResponse { total_videos: total, popular, rows, tags }))
}

#[derive(Debug, Deserialize)]
pub struct ListParams {
    limit: Option<i64>,
    offset: Option<i64>,
    kind: Option<String>,
    sort: Option<String>,
    q: Option<String>,
    category: Option<String>,
    tag: Option<String>,
}

pub async fn videos(
    State(pool): State<PgPool>,
    Query(p): Query<ListParams>,
) -> Result<Json<VideoListResponse>, ApiError> {
    let limit = p.limit.unwrap_or(24).clamp(1, 60);
    let offset = p.offset.unwrap_or(0).max(0);
    let kind = p.kind.filter(|k| k != "all" && !k.is_empty());
    let q = p.q.filter(|s| !s.trim().is_empty()).map(|s| s.trim().to_string());
    let category = p.category.filter(|s| !s.is_empty());
    let tag = p.tag.filter(|s| !s.is_empty());

    let where_sql = r#"
        where ($1::text is null or v.kind = $1)
          and ($2::text is null or exists (
                select 1 from video_categories vc join categories c on c.id = vc.category_id
                where vc.video_id = v.id and c.slug = $2))
          and ($3::text is null or exists (
                select 1 from video_tags vt join tags t on t.id = vt.tag_id
                where vt.video_id = v.id and t.slug = $3))
          and ($4::text is null or v.title ilike '%' || $4 || '%' or v.description ilike '%' || $4 || '%')
    "#;

    let order_sql = match p.sort.as_deref() {
        Some("weekly") => "order by v.weekly_views desc nulls last, v.view_count desc",
        Some("popular") => "order by v.view_count desc",
        _ => "order by v.published_at desc",
    };

    let count_sql = format!("select count(*) from videos v {where_sql}");
    let total: i64 = sqlx::query_scalar(&count_sql)
        .bind(&kind)
        .bind(&category)
        .bind(&tag)
        .bind(&q)
        .fetch_one(&pool)
        .await?;

    let sql = format!("{VIDEO_SELECT} {where_sql} {order_sql} limit $5 offset $6");
    let rows: Vec<VideoRow> = sqlx::query_as(&sql)
        .bind(&kind)
        .bind(&category)
        .bind(&tag)
        .bind(&q)
        .bind(limit)
        .bind(offset)
        .fetch_all(&pool)
        .await?;

    Ok(Json(VideoListResponse {
        items: rows.into_iter().map(VideoCard::from).collect(),
        total,
    }))
}

pub async fn video_detail(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> Result<Json<VideoDetailResponse>, ApiError> {
    let sql = format!("{VIDEO_SELECT} where v.id = $1");
    let row: Option<VideoRow> = sqlx::query_as(&sql).bind(&id).fetch_optional(&pool).await?;
    let Some(row) = row else {
        return Err(ApiError::not_found("video not found"));
    };

    let video = VideoDetail {
        id: row.id.clone(),
        title: row.title,
        description: row.description,
        published_at: row.published_at,
        duration_seconds: row.duration_seconds,
        kind: row.kind,
        thumbnail_url: row.thumbnail_url,
        view_count: row.view_count,
        like_count: row.like_count,
        categories: row.categories.0,
        tags: row.tags.0,
        youtube_url: format!("https://www.youtube.com/watch?v={}", row.id),
        embed_url: format!("https://www.youtube.com/embed/{}?rel=0", row.id),
    };

    // related: same category, most recent first
    let related_sql = format!(
        "{VIDEO_SELECT} join video_categories vc on vc.video_id = v.id \
         join categories c on c.id = vc.category_id \
         where c.slug in (select c2.slug from video_categories vc2 join categories c2 on c2.id = vc2.category_id where vc2.video_id = $1) \
           and v.id <> $1 \
         group by v.id order by v.published_at desc limit 8"
    );
    let related: Vec<VideoRow> = sqlx::query_as(&related_sql).bind(&id).fetch_all(&pool).await?;

    // graph_related: shares the most tags
    let graph_sql = format!(
        "select * from ({VIDEO_SELECT} join video_tags vt on vt.video_id = v.id \
         where vt.tag_id in (select tag_id from video_tags where video_id = $1) and v.id <> $1 \
         group by v.id \
         order by count(vt.tag_id) desc, v.view_count desc limit 6) t"
    );
    let graph: Vec<VideoRow> = sqlx::query_as(&graph_sql).bind(&id).fetch_all(&pool).await?;

    Ok(Json(VideoDetailResponse {
        video,
        related: related.into_iter().map(VideoCard::from).collect(),
        graph_related: graph.into_iter().map(VideoCard::from).collect(),
    }))
}

pub async fn categories(State(pool): State<PgPool>) -> Result<Json<Vec<CategoryRow>>, ApiError> {
    let rows: Vec<CategoryRow> = sqlx::query_as(
        r#"
        select c.slug, c.name, c.description, count(vc.video_id) as video_count
        from categories c left join video_categories vc on vc.category_id = c.id
        group by c.id order by c.sort_order asc, c.name asc
        "#,
    )
    .fetch_all(&pool)
    .await?;
    Ok(Json(rows))
}

pub async fn tags(State(pool): State<PgPool>) -> Result<Json<Vec<TagRow>>, ApiError> {
    let rows: Vec<TagRow> = sqlx::query_as(
        r#"
        select t.slug, t.name, count(vt.video_id) as video_count
        from tags t left join video_tags vt on vt.tag_id = t.id
        group by t.id order by video_count desc, t.name asc
        "#,
    )
    .fetch_all(&pool)
    .await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize)]
pub struct StatsResponse {
    pub videos: i64,
    pub shorts: i64,
    pub long_form: i64,
    pub categories: i64,
    pub tags: i64,
    pub total_views: i64,
    pub newest: Option<String>,
}

pub async fn stats(State(pool): State<PgPool>) -> Result<Json<StatsResponse>, ApiError> {
    let r = sqlx::query(
        r#"
        select (select count(*) from videos) as videos,
               (select count(*) from videos where kind = 'short') as shorts,
               (select count(*) from videos where kind = 'long') as long_form,
               (select count(*) from categories) as categories,
               (select count(*) from tags) as tags,
               (select coalesce(sum(view_count), 0)::bigint from videos) as total_views,
               (select id from videos order by published_at desc limit 1) as newest
        "#,
    )
    .fetch_one(&pool)
    .await?;
    Ok(Json(StatsResponse {
        videos: r.try_get("videos")?,
        shorts: r.try_get("shorts")?,
        long_form: r.try_get("long_form")?,
        categories: r.try_get("categories")?,
        tags: r.try_get("tags")?,
        total_views: r.try_get("total_views")?,
        newest: r.try_get("newest").ok(),
    }))
}

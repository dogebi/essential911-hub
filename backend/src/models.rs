use serde::{Deserialize, Serialize};
use sqlx::types::Json;
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatRef {
    pub slug: String,
    pub name: String,
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct VideoRow {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing)]
    pub description: String,
    pub published_at: chrono::DateTime<chrono::Utc>,
    pub duration_seconds: i32,
    pub kind: String,
    pub thumbnail_url: String,
    pub view_count: i64,
    pub like_count: i64,
    pub weekly_views: Option<i64>,
    pub categories: Json<Vec<CatRef>>,
    pub tags: Json<Vec<CatRef>>,
}

#[derive(Debug, Serialize)]
pub struct VideoCard {
    pub id: String,
    pub title: String,
    pub published_at: chrono::DateTime<chrono::Utc>,
    pub duration_seconds: i32,
    pub kind: String,
    pub thumbnail_url: String,
    pub view_count: i64,
    pub like_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub weekly_views: Option<i64>,
    pub categories: Vec<CatRef>,
    pub tags: Vec<CatRef>,
}

impl From<VideoRow> for VideoCard {
    fn from(r: VideoRow) -> Self {
        VideoCard {
            id: r.id,
            title: r.title,
            published_at: r.published_at,
            duration_seconds: r.duration_seconds,
            kind: r.kind,
            thumbnail_url: r.thumbnail_url,
            view_count: r.view_count,
            like_count: r.like_count,
            weekly_views: r.weekly_views,
            categories: r.categories.0,
            tags: r.tags.0,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct VideoDetail {
    pub id: String,
    pub title: String,
    pub description: String,
    pub published_at: chrono::DateTime<chrono::Utc>,
    pub duration_seconds: i32,
    pub kind: String,
    pub thumbnail_url: String,
    pub view_count: i64,
    pub like_count: i64,
    pub categories: Vec<CatRef>,
    pub tags: Vec<CatRef>,
    pub youtube_url: String,
    pub embed_url: String,
}

#[derive(Debug, FromRow, Serialize)]
pub struct CategoryRow {
    pub slug: String,
    pub name: String,
    pub description: String,
    pub video_count: i64,
}

#[derive(Debug, FromRow, Serialize)]
pub struct TagRow {
    pub slug: String,
    pub name: String,
    pub video_count: i64,
}

#[derive(Debug, Serialize)]
pub struct CategoryBlock {
    #[serde(flatten)]
    pub category: CategoryRow,
    pub videos: Vec<VideoCard>,
}

#[derive(Debug, Serialize)]
pub struct HomeResponse {
    pub total_videos: i64,
    pub popular: Vec<VideoCard>,
    pub rows: Vec<CategoryBlock>,
    pub tags: Vec<TagRow>,
}

#[derive(Debug, Serialize)]
pub struct VideoListResponse {
    pub items: Vec<VideoCard>,
    pub total: i64,
}

#[derive(Debug, Serialize)]
pub struct VideoDetailResponse {
    pub video: VideoDetail,
    pub related: Vec<VideoCard>,
    pub graph_related: Vec<VideoCard>,
}

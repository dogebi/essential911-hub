mod api;
mod models;
mod seed;

use std::{convert::Infallible, net::SocketAddr, path::PathBuf};

use axum::{
    body::Body,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    services::ServeDir,
    trace::TraceLayer,
};

/// Static assets first, then the SPA shell with a 200 for any unmatched GET path.
/// (ServeDir's own `not_found_service` keeps the 404 status, which breaks deep links.)
fn spa_fallback(dist: PathBuf) -> impl tower::Service<
    axum::extract::Request,
    Response = Response,
    Error = Infallible,
    Future = impl std::future::Future<Output = Result<Response, Infallible>>,
> + Clone {
    let index = dist.join("index.html");
    let serve = ServeDir::new(dist);

    tower::service_fn(move |req: axum::extract::Request| {
        let serve = serve.clone();
        let index = index.clone();
        async move {
            match serve.oneshot(req).await {
                Ok(r) if r.status() != StatusCode::NOT_FOUND => Ok(r.map(Body::new)),
                _ => match tokio::fs::read(&index).await {
                    Ok(bytes) => Ok(Response::builder()
                        .status(StatusCode::OK)
                        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
                        .body(Body::from(bytes))
                        .expect("static response builds")),
                    Err(_) => Ok(StatusCode::NOT_FOUND.into_response()),
                },
            }
        }
    })
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=warn".into()),
        )
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://hub@127.0.0.1:5434/essential911_hub".to_string());
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8099);
    let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "frontend/dist".to_string());

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;
    tracing::info!("database connected");

    // raw_sql allows the multi-statement migration file (sqlx::query only takes one statement)
    sqlx::raw_sql(include_str!("../migrations/0001_schema.sql"))
        .execute(&pool)
        .await?;
    tracing::info!("schema applied");

    let seeded = seed::seed_if_empty(&pool).await?;
    if seeded {
        tracing::info!("seed data inserted");
    }

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let mut app = Router::new()
        .route("/api/health", get(api::health))
        .route("/api/stats", get(api::stats))
        .route("/api/home", get(api::home))
        .route("/api/videos", get(api::videos))
        .route("/api/videos/{id}", get(api::video_detail))
        .route("/api/categories", get(api::categories))
        .route("/api/tags", get(api::tags))
        .route("/api/reseed", post(seed::reseed))
        .with_state(pool)
        .layer(cors)
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http());

    let dist = PathBuf::from(&static_dir);
    if dist.join("index.html").exists() {
        app = app.fallback_service(spa_fallback(dist.clone()));
        tracing::info!("serving frontend from {}", dist.display());
    } else {
        tracing::warn!("no frontend build at {} (API only)", dist.display());
    }

    let addr_str = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let ip: std::net::IpAddr = addr_str.parse()?;
    let addr = SocketAddr::from((ip, port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("essential911-hub api listening on http://{addr}");
    axum::serve(listener, app).await?;
    Ok(())
}

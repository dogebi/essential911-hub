-- essential911-hub schema (PostgreSQL 16)
create table if not exists videos (
    id               text primary key,
    title            text        not null,
    description      text        not null default '',
    published_at     timestamptz not null,
    duration_seconds integer     not null default 0,
    kind             text        not null check (kind in ('short', 'long')),
    thumbnail_url    text        not null,
    view_count       bigint      not null default 0,
    like_count       bigint      not null default 0,
    weekly_views     bigint,
    created_at       timestamptz not null default now()
);

create index if not exists videos_published_idx on videos (published_at desc);
create index if not exists videos_views_idx on videos (view_count desc);

create table if not exists categories (
    id          serial primary key,
    slug        text    not null unique,
    name        text    not null,
    description text    not null default '',
    sort_order  integer not null default 0
);

create table if not exists tags (
    id   serial primary key,
    slug text not null unique,
    name text not null
);

create table if not exists video_categories (
    video_id    text    not null references videos (id) on delete cascade,
    category_id integer not null references categories (id) on delete cascade,
    primary key (video_id, category_id)
);

create table if not exists video_tags (
    video_id text    not null references videos (id) on delete cascade,
    tag_id   integer not null references tags (id) on delete cascade,
    primary key (video_id, tag_id)
);

create index if not exists video_categories_cat_idx on video_categories (category_id);
create index if not exists video_tags_tag_idx on video_tags (tag_id);

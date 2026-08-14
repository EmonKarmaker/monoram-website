-- =====================================================================
--  Monoram Jewellers — database setup
--  Paste this whole file into Supabase -> SQL Editor -> Run. Once only.
-- =====================================================================

-- ---------- 1. SHOP SETTINGS (always exactly one row) ----------------
create table if not exists public.settings (
  id             int primary key default 1,
  shop_name      text,
  tagline        text,
  hero_title     text,
  hero_title_bn  text,
  hero_text      text,
  hero_text_bn   text,
  address        text,
  address_bn     text,
  phone1         text,
  phone2         text,
  whatsapp       text,
  email          text,
  proprietor       text,                    -- shown in the footer and on the rate picture
  proprietor_bn    text,
  facebook_page    text,                    -- the shop's Facebook page
  facebook_profile text,                    -- the proprietor's own profile
  -- Which unit CUSTOMERS SEE. Not to be confused with rates.unit, which
  -- records the unit the owner TYPED for one rate row. This is display only.
  rate_unit      text default 'gram'        -- 'gram' | 'bhori' | 'both'
                 check (rate_unit is null or rate_unit in ('gram','bhori','both')),
  map_url        text,                      -- footer map link; blank = the built-in shop pin
  hours          text,
  hours_bn       text,
  closed_day     text,
  closed_day_bn  text,
  banner_on      boolean default false,
  banner_text    text,
  banner_text_bn text,
  show_hallmark  boolean default true,
  show_slip      boolean default true,
  show_exchange  boolean default true,
  show_repair    boolean default true,
  bajus_member   boolean default true,
  -- ----- appearance, all editable from the admin page -----
  logo_key        text default 'D5-padma-lotus',
  logo_custom     text,                     -- pasted/uploaded SVG, wins over logo_key
  layout          text default 'thread',    -- thread | invitation | ornate
  style_language  text default 'minimal',   -- minimal | ornate
  festival        text default 'none',
  theme_accent_override text,
  theme_default   text default 'night',     -- night | ivory
  theme_toggle    boolean default true,
  -- ----- background effects -----
  fx_on           boolean default true,
  fx_density      text default 'normal',    -- low | normal | high
  fx_twinkle      boolean default true,     -- night: stars fade in and out
  fx_drift        boolean default true,     -- night: field shifts with the finger
  fx_glow         boolean default true,     -- night: stars brighten near the finger
  fx_shooting     boolean default true,     -- night: occasional shooting star
  fx_web          boolean default true,     -- ivory: filigree web that reaches for the finger
  fx_grain        boolean default true,     -- ivory: fine paper texture
  show_admin_link boolean default true,     -- "Shop login" button in the footer
  updated_at     timestamptz default now(),
  constraint settings_single_row check (id = 1)
);

-- ---------- 2. GOLD RATES (one row per BAJUS announcement) -----------
-- No 18 carat. 22, 21, traditional, silver.
create table if not exists public.rates (
  id         bigint generated always as identity primary key,
  effective  text not null,
  k22        numeric not null,
  k21        numeric not null,
  trad       numeric not null,
  silver     numeric,
  -- Which unit the four numbers above are written in. The owner's source
  -- publishes per gram, so that is the default. Rows saved before this
  -- column existed are per bhori and are marked 'bhori' by patch2.sql.
  unit       text default 'gram' check (unit is null or unit in ('gram', 'bhori')),
  created_at timestamptz default now()
);
create index if not exists rates_created_idx on public.rates (created_at desc);

-- ---------- 3. PRODUCTS ----------------------------------------------
create table if not exists public.products (
  id               bigint generated always as identity primary key,
  name             text not null,
  name_bn          text,
  category         text,
  category_bn      text,
  blurb            text,                    -- one short line shown on the card
  blurb_bn         text,
  karat            text,
  weight_bhori     numeric,
  price            numeric,
  price_on_request boolean default false,
  tag              text,
  tag_bn           text,
  featured         boolean default false,
  sold             boolean default false,
  photo_url        text,
  photo_path       text,
  -- The pixel size of the saved photograph, written by the admin page when
  -- it compresses the upload. The website reserves exactly this shape
  -- before the picture arrives, so the page does not jump on a slow phone.
  -- NULL means "not measured" — the website measures the picture itself.
  photo_w          int,
  photo_h          int,
  sort             int default 0,
  created_at       timestamptz default now(),
  constraint products_photo_size_sane
    check ((photo_w is null or photo_w > 0) and (photo_h is null or photo_h > 0))
);
create index if not exists products_sort_idx on public.products (sort, created_at desc);

-- ---------- 4. VIEW COUNTER ------------------------------------------
create table if not exists public.views (
  id         bigint generated always as identity primary key,
  kind       text not null,               -- 'page' | 'product'
  product_id bigint,
  created_at timestamptz default now()
);
create index if not exists views_created_idx on public.views (created_at desc);

-- ---------- 5. FESTIVAL CARDS ----------------------------------------
create table if not exists public.festivals (
  id              bigint generated always as identity primary key,
  name            text not null,            -- your own label, e.g. "Eid 2026"
  festival_key    text default 'none',      -- palette: eid | puja | boishakh | wedding | victory
  title           text,
  title_bn        text,
  text            text,
  text_bn         text,
  cta_text        text,
  cta_text_bn     text,
  cta_link        text,
  image_url       text,
  image_path      text,
  image_has_text  boolean default false,    -- true = show my picture untouched
  active          boolean default false,
  ends_on         date,                     -- blank = never expires
  created_at      timestamptz default now()
);
create index if not exists festivals_active_idx on public.festivals (active, ends_on);

-- =====================================================================
--  SECURITY.  Anyone may READ the shop. Only a logged-in admin WRITES.
-- =====================================================================
alter table public.settings enable row level security;
alter table public.rates    enable row level security;
alter table public.products enable row level security;
alter table public.views    enable row level security;
alter table public.festivals enable row level security;

drop policy if exists "read settings"  on public.settings;
drop policy if exists "write settings" on public.settings;
create policy "read settings"  on public.settings for select using (true);
create policy "write settings" on public.settings for all to authenticated
  using (true) with check (true);

drop policy if exists "read rates"  on public.rates;
drop policy if exists "write rates" on public.rates;
create policy "read rates"  on public.rates for select using (true);
create policy "write rates" on public.rates for all to authenticated
  using (true) with check (true);

drop policy if exists "read products"  on public.products;
drop policy if exists "write products" on public.products;
create policy "read products"  on public.products for select using (true);
create policy "write products" on public.products for all to authenticated
  using (true) with check (true);

drop policy if exists "read festivals"  on public.festivals;
drop policy if exists "write festivals" on public.festivals;
create policy "read festivals"  on public.festivals for select using (true);
create policy "write festivals" on public.festivals for all to authenticated
  using (true) with check (true);

drop policy if exists "add view"   on public.views;
drop policy if exists "read views" on public.views;
create policy "add view"   on public.views for insert with check (true);
create policy "read views" on public.views for select to authenticated using (true);

-- =====================================================================
--  PHOTO STORAGE
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "public read photos"   on storage.objects;
drop policy if exists "admin upload photos"  on storage.objects;
drop policy if exists "admin update photos"  on storage.objects;
drop policy if exists "admin delete photos"  on storage.objects;

create policy "public read photos"  on storage.objects for select
  using (bucket_id = 'photos');
create policy "admin upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos');
create policy "admin update photos" on storage.objects for update to authenticated
  using (bucket_id = 'photos');
create policy "admin delete photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos');

-- =====================================================================
--  SEED — your real, confirmed details only. Nothing invented.
--  Hours, closing day, hero wording and banner are left blank for you.
--  No products. No rates. The shop starts empty.
-- =====================================================================
insert into public.settings (id, shop_name, tagline, address, phone1, phone2, whatsapp, email,
                             proprietor, facebook_page, facebook_profile,
                             show_hallmark, show_slip, show_exchange, show_repair, bajus_member)
values (1,
        'Monoram Jewellers',
        'Gold · Diamond · Silver · Ornaments',
        'Mujib Sarak, Sirajganj',
        '+880 1762-436392',
        '+880 2588-830677',      -- landline. Never used for WhatsApp.
        '8801762436392',         -- WhatsApp is the mobile, ending 92.
        'rkarmaker948@gmail.com',
        'Ratan Karmoker',
        'https://www.facebook.com/people/Monoram-Jewellers/61592891604973/',
        'https://www.facebook.com/roton.karmaker.737',
        true, true, true, true, true)
on conflict (id) do nothing;

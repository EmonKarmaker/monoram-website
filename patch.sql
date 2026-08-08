-- Adds the newer 'settings' columns to a database created from an older setup.sql. Safe to run more than once.
-- =====================================================================
--  Monoram Jewellers — patch for an ALREADY-INSTALLED database
--
--  Run this in Supabase -> SQL Editor -> Run if the admin page says a
--  column could not be found (for example: "Could not find the
--  'fx_density' column of 'settings' in the schema cache").
--
--  It only ADDS missing columns. It never deletes anything, never
--  touches your saved details, never changes the security rules or the
--  photo storage. Running it twice does nothing the second time.
-- =====================================================================

-- ----- footer map link (blank = the built-in shop pin) ---------------
alter table public.settings add column if not exists map_url text;

-- ----- appearance ----------------------------------------------------
alter table public.settings add column if not exists logo_key       text default 'D5-padma-lotus';
alter table public.settings add column if not exists logo_custom    text;
alter table public.settings add column if not exists layout         text default 'thread';
alter table public.settings add column if not exists style_language text default 'minimal';
alter table public.settings add column if not exists festival       text default 'none';
alter table public.settings add column if not exists theme_accent_override text;
alter table public.settings add column if not exists theme_default  text default 'night';
alter table public.settings add column if not exists theme_toggle   boolean default true;

-- ----- background effects --------------------------------------------
alter table public.settings add column if not exists fx_on       boolean default true;
alter table public.settings add column if not exists fx_density  text    default 'normal';  -- low | normal | high
alter table public.settings add column if not exists fx_twinkle  boolean default true;      -- night: stars fade in and out
alter table public.settings add column if not exists fx_drift    boolean default true;      -- night: field shifts with the finger
alter table public.settings add column if not exists fx_glow     boolean default true;      -- night: stars brighten near the finger
alter table public.settings add column if not exists fx_shooting boolean default true;      -- night: occasional shooting star
alter table public.settings add column if not exists fx_web      boolean default true;      -- ivory: filigree web
alter table public.settings add column if not exists fx_grain    boolean default true;      -- ivory: fine paper texture

-- ----- footer "Shop login" button -------------------------------------
alter table public.settings add column if not exists show_admin_link boolean default true;

-- ----- the single settings row keeps the new defaults -----------------
-- (a column added later starts out empty on the existing row, so fill it in)
update public.settings set
  layout          = coalesce(layout,          'thread'),
  style_language  = coalesce(style_language,  'minimal'),
  festival        = coalesce(festival,        'none'),
  theme_default   = coalesce(theme_default,   'night'),
  theme_toggle    = coalesce(theme_toggle,    true),
  fx_on           = coalesce(fx_on,           true),
  fx_density      = coalesce(fx_density,      'normal'),
  fx_twinkle      = coalesce(fx_twinkle,      true),
  fx_drift        = coalesce(fx_drift,        true),
  fx_glow         = coalesce(fx_glow,         true),
  fx_shooting     = coalesce(fx_shooting,     true),
  fx_web          = coalesce(fx_web,          true),
  fx_grain        = coalesce(fx_grain,        true),
  show_admin_link = coalesce(show_admin_link, true)
where id = 1;

-- ----- tell the API about the new columns ------------------------------
notify pgrst, 'reload schema';

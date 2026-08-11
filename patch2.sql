-- =====================================================================
--  Monoram Jewellers — patch 2, for an ALREADY-INSTALLED database
--
--  Run this in Supabase -> SQL Editor -> Run.
--  It only ADDS columns and fills in blanks. It never deletes a column,
--  never renames one, never removes a row, and never changes a price or
--  a rate you have already published. Running it twice is harmless.
--
--  What it is for:
--    1. Gold rates now arrive PER GRAM. Every rate row records which
--       unit its numbers are in, so the rates you published before today
--       keep reading correctly as per-bhori figures.
--    2. The proprietor's name and the two Facebook links.
--    3. A short description line for each piece in the collection.
-- =====================================================================


-- ---------- 1. RATES: which unit is this row written in? -------------
--
--  IMPORTANT, and why this is done in three steps rather than one:
--  in PostgreSQL, adding a column that already has a DEFAULT fills every
--  existing row with that default. If the column were created as
--  "text default 'gram'", every rate already in the table would be
--  stamped 'gram' — but those rows are per bhori, and the website would
--  then show a price about eleven and a half times too small.
--
--  So: add the column empty, mark the existing rows 'bhori', and only
--  then make 'gram' the default for rows added from now on.

alter table public.rates add column if not exists unit text;

update public.rates set unit = 'bhori' where unit is null;   -- everything published so far

alter table public.rates alter column unit set default 'gram';   -- everything from now on

-- a rate row must say which unit it is in
alter table public.rates
  drop constraint if exists rates_unit_known;
alter table public.rates
  add constraint rates_unit_known check (unit is null or unit in ('gram', 'bhori'));


-- ---------- 2. SETTINGS: proprietor and Facebook ---------------------
alter table public.settings add column if not exists proprietor       text;
alter table public.settings add column if not exists proprietor_bn    text;
alter table public.settings add column if not exists facebook_page    text;
alter table public.settings add column if not exists facebook_profile text;

-- Seed only where the field is still empty, so anything you have typed
-- into the admin page yourself is never overwritten.
update public.settings set proprietor = 'Ratan Karmoker'
  where id = 1 and proprietor is null;

update public.settings
  set facebook_page = 'https://www.facebook.com/people/Monoram-Jewellers/61592891604973/'
  where id = 1 and facebook_page is null;

update public.settings
  set facebook_profile = 'https://www.facebook.com/roton.karmaker.737'
  where id = 1 and facebook_profile is null;


-- ---------- 3. PRODUCTS: a short line under the name -----------------
alter table public.products add column if not exists blurb    text;
alter table public.products add column if not exists blurb_bn text;


-- ---------- tell the API about the new columns -----------------------
notify pgrst, 'reload schema';

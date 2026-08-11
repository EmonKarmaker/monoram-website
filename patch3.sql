-- =====================================================================
--  Monoram Jewellers — patch 3, for an ALREADY-INSTALLED database
--
--  Run this in Supabase -> SQL Editor -> Run, AFTER patch2.sql.
--  It adds one column and nothing else. It never deletes a column, never
--  renames one, never removes a row, and never changes a rate you have
--  already published. Running it twice is harmless.
--
--  What it is for: choosing which unit customers see on the website.
-- =====================================================================


-- ---------- Which unit the WEBSITE SHOWS -----------------------------
--
--  Two different ideas, deliberately kept apart. Do not merge them:
--
--    rates.unit         (added in patch2.sql) — the unit the OWNER TYPED
--                       for that one rate row, 'gram' or 'bhori'. It is a
--                       fact about how the number was entered. Once a row
--                       is saved this never changes.
--
--    settings.rate_unit (added here) — the unit CUSTOMERS SEE on the
--                       website. Purely a display choice. It does not
--                       touch a single stored number, and changing it
--                       cannot make any published rate wrong.
--
--  Unlike the rates.unit column in patch2.sql, a DEFAULT is safe here.
--  Adding a column with a default backfills every existing row with it —
--  and that is exactly what is wanted, because there is only the one
--  settings row and 'gram' is the value it should have.

alter table public.settings
  add column if not exists rate_unit text default 'gram';   -- 'gram' | 'bhori' | 'both'

-- the settings row must never be left empty on this column
update public.settings set rate_unit = 'gram' where id = 1 and rate_unit is null;

alter table public.settings
  drop constraint if exists settings_rate_unit_known;
alter table public.settings
  add constraint settings_rate_unit_known
  check (rate_unit is null or rate_unit in ('gram', 'bhori', 'both'));


-- ---------- tell the API about the new column ------------------------
notify pgrst, 'reload schema';

-- =====================================================================
--  Monoram Jewellers — patch 4, for an ALREADY-INSTALLED database
--
--  Run this in Supabase -> SQL Editor -> Run, AFTER patch3.sql.
--  It adds two columns and nothing else. It never deletes a column, never
--  renames one, never removes a row, and never changes a price, a rate or
--  a photograph you have already published. Running it twice is harmless.
--
--  What it is for: letting every photograph keep its own shape on the
--  website instead of being cropped to a square.
-- =====================================================================


-- ---------- The SHAPE of each photograph -----------------------------
--
--  photo_w and photo_h are the width and height, in pixels, of the
--  picture as it was actually saved to storage. The admin page already
--  redraws every upload onto a 1200px canvas before it sends it, so it
--  knows both numbers at that moment and writes them here for free. The
--  owner never types them and never sees them.
--
--  The website uses them to reserve exactly the right amount of space for
--  a photograph BEFORE it has arrived, so nothing on the page jumps while
--  the pictures are still loading over a slow connection.
--
--  NO DEFAULT ON PURPOSE.
--  `add column ... default 1200` would write 1200 into every piece
--  already in the collection, which would be a made-up shape claimed as a
--  measured one — and the website would then reserve the wrong space and
--  jump anyway. Left as NULL, the website knows it does not know, and
--  measures those photographs from the picture itself as they load. Each
--  old piece corrects itself the next time its photograph is re-uploaded.

alter table public.products
  add column if not exists photo_w int;     -- pixel width  of the saved photo

alter table public.products
  add column if not exists photo_h int;     -- pixel height of the saved photo

-- A shape is either fully known or not known at all. A stray zero or a
-- negative number would be divided by, so refuse those outright rather
-- than letting one reach the website.
alter table public.products
  drop constraint if exists products_photo_size_sane;
alter table public.products
  add constraint products_photo_size_sane
  check ((photo_w is null or photo_w > 0) and (photo_h is null or photo_h > 0));


-- ---------- tell the API about the new columns -----------------------
notify pgrst, 'reload schema';

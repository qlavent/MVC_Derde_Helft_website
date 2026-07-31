-- Venue name per match ("Sporthal Palaestra", "Sporthal Vinkt").
--
-- RBFA exposes it on the calendar item as location { id name address city postalCode }.
-- Only the name is stored: that is the useful bit on screen. Address and city are one line
-- away in the sync if a maps link is ever wanted.
--
-- Nullable on purpose: last season's 27 matches are gone from RBFA's calendar, so they will
-- never get a venue and the UI has to cope with null anyway.

alter table matches add column if not exists location_name text;

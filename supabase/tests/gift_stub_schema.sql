-- Stub für die SQL-Tests des Geschenkkorb-Bestands (gift_stock.sql) in PGlite. NUR Wegwerf-DB, NIE Supabase/Produktion.
-- Bildet nach, was die Gift-Migrationen außerhalb ihres Schemas brauchen: Rollen, auth.*, has_role, update_updated_at_column,
-- pg_cron/pg_net (nur Aufrufe, keine Ausführung). Runner: supabase/tests/run-gift-sql-tests.mjs
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'service_role') $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'customer');
CREATE TABLE public.user_roles (user_id uuid NOT NULL, role public.app_role NOT NULL);
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;  -- Test: jeder darf Admin-RPCs rufen
CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE SCHEMA cron;
CREATE FUNCTION cron.schedule(text, text, text) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
CREATE FUNCTION cron.unschedule(bigint) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE TABLE cron.job (jobid bigint, jobname text);
CREATE SCHEMA net;
CREATE FUNCTION net.http_post(url text, headers jsonb, body jsonb) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;

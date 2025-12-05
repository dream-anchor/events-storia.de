CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'staff'
);


--
-- Name: menu_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.menu_type AS ENUM (
    'lunch',
    'food',
    'drinks',
    'christmas',
    'valentines',
    'special'
);


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: menu_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    menu_id uuid NOT NULL,
    name text NOT NULL,
    name_en text,
    description text,
    description_en text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    name text NOT NULL,
    name_en text,
    description text,
    description_en text,
    price numeric(10,2),
    price_display text,
    allergens text,
    is_vegetarian boolean DEFAULT false,
    is_vegan boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: menus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menus (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    menu_type public.menu_type NOT NULL,
    title text,
    subtitle text,
    pdf_url text,
    is_published boolean DEFAULT false,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    title_en text,
    subtitle_en text,
    sort_order integer DEFAULT 0,
    slug text
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: menu_categories menu_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_pkey PRIMARY KEY (id);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: menus menus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menus
    ADD CONSTRAINT menus_pkey PRIMARY KEY (id);


--
-- Name: menus menus_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menus
    ADD CONSTRAINT menus_slug_key UNIQUE (slug);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_menus_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menus_slug ON public.menus USING btree (slug);


--
-- Name: menus update_menus_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_menus_updated_at BEFORE UPDATE ON public.menus FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: menu_categories menu_categories_menu_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES public.menus(id) ON DELETE CASCADE;


--
-- Name: menu_items menu_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.menu_categories(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: menu_categories Admins can delete categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete categories" ON public.menu_categories FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: menu_items Admins can delete items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete items" ON public.menu_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: menus Admins can delete menus; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete menus" ON public.menus FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: menu_categories Admins can insert categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert categories" ON public.menu_categories FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: menu_items Admins can insert items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert items" ON public.menu_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: menus Admins can insert menus; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert menus" ON public.menus FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: menu_categories Admins can update categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update categories" ON public.menu_categories FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: menu_items Admins can update items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update items" ON public.menu_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: menus Admins can update menus; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update menus" ON public.menus FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: menu_categories Admins can view all categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all categories" ON public.menu_categories FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: menu_items Admins can view all items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all items" ON public.menu_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: menus Admins can view all menus; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all menus" ON public.menus FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: menu_categories Categories of published menus are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Categories of published menus are viewable by everyone" ON public.menu_categories FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.menus
  WHERE ((menus.id = menu_categories.menu_id) AND (menus.is_published = true)))));


--
-- Name: menu_items Items of published menus are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Items of published menus are viewable by everyone" ON public.menu_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.menu_categories
     JOIN public.menus ON ((menus.id = menu_categories.menu_id)))
  WHERE ((menu_categories.id = menu_items.category_id) AND (menus.is_published = true)))));


--
-- Name: menus Published menus are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Published menus are viewable by everyone" ON public.menus FOR SELECT USING ((is_published = true));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: menu_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

--
-- Name: menus; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--



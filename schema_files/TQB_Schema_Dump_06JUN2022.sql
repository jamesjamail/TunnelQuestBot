--
-- PostgreSQL database dump
--

-- Dumped from database version 12.1
-- Dumped by pg_dump version 12.1

-- Started on 2022-06-10 03:22:06

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 211 (class 1259 OID 16920)
-- Name: blocked_seller_by_user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blocked_seller_by_user (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    server character varying(10),
    seller character varying(30) NOT NULL
);


ALTER TABLE public.blocked_seller_by_user OWNER TO postgres;

--
-- TOC entry 210 (class 1259 OID 16918)
-- Name: blocked_seller_by_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.blocked_seller_by_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.blocked_seller_by_user_id_seq OWNER TO postgres;

--
-- TOC entry 2916 (class 0 OID 0)
-- Dependencies: 210
-- Name: blocked_seller_by_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.blocked_seller_by_user_id_seq OWNED BY public.blocked_seller_by_user.id;


--
-- TOC entry 217 (class 1259 OID 16995)
-- Name: blocked_seller_by_watch; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blocked_seller_by_watch (
    id bigint NOT NULL,
    watch_id bigint NOT NULL,
    seller text NOT NULL
);


ALTER TABLE public.blocked_seller_by_watch OWNER TO postgres;

--
-- TOC entry 216 (class 1259 OID 16993)
-- Name: blocked_seller_by_watch_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.blocked_seller_by_watch_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.blocked_seller_by_watch_id_seq OWNER TO postgres;

--
-- TOC entry 2917 (class 0 OID 0)
-- Dependencies: 216
-- Name: blocked_seller_by_watch_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.blocked_seller_by_watch_id_seq OWNED BY public.blocked_seller_by_watch.id;


--
-- TOC entry 215 (class 1259 OID 16977)
-- Name: communication_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.communication_history (
    id bigint NOT NULL,
    watch_id bigint NOT NULL,
    seller text NOT NULL,
    "timestamp" timestamp without time zone NOT NULL
);


ALTER TABLE public.communication_history OWNER TO postgres;

--
-- TOC entry 214 (class 1259 OID 16975)
-- Name: communication_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.communication_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.communication_history_id_seq OWNER TO postgres;

--
-- TOC entry 2918 (class 0 OID 0)
-- Dependencies: 214
-- Name: communication_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.communication_history_id_seq OWNED BY public.communication_history.id;


--
-- TOC entry 202 (class 1259 OID 16831)
-- Name: items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.items (
    name character varying(99),
    id bigint NOT NULL
);


ALTER TABLE public.items OWNER TO postgres;

--
-- TOC entry 203 (class 1259 OID 16834)
-- Name: items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.items_id_seq OWNER TO postgres;

--
-- TOC entry 2919 (class 0 OID 0)
-- Dependencies: 203
-- Name: items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.items_id_seq OWNED BY public.items.id;


--
-- TOC entry 204 (class 1259 OID 16836)
-- Name: servers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.servers (
    name character varying,
    id bigint NOT NULL
);


ALTER TABLE public.servers OWNER TO postgres;

--
-- TOC entry 205 (class 1259 OID 16842)
-- Name: servers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.servers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.servers_id_seq OWNER TO postgres;

--
-- TOC entry 2920 (class 0 OID 0)
-- Dependencies: 205
-- Name: servers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.servers_id_seq OWNED BY public.servers.id;


--
-- TOC entry 213 (class 1259 OID 16933)
-- Name: snooze_by_user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.snooze_by_user (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    expiration timestamp without time zone NOT NULL
);


ALTER TABLE public.snooze_by_user OWNER TO postgres;

--
-- TOC entry 212 (class 1259 OID 16931)
-- Name: snooze_by_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.snooze_by_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.snooze_by_user_id_seq OWNER TO postgres;

--
-- TOC entry 2921 (class 0 OID 0)
-- Dependencies: 212
-- Name: snooze_by_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.snooze_by_user_id_seq OWNED BY public.snooze_by_user.id;


--
-- TOC entry 219 (class 1259 OID 17013)
-- Name: snooze_by_watch; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.snooze_by_watch (
    id bigint NOT NULL,
    watch_id bigint NOT NULL,
    expiration timestamp without time zone NOT NULL
);


ALTER TABLE public.snooze_by_watch OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 17011)
-- Name: snooze_by_watch_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.snooze_by_watch_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.snooze_by_watch_id_seq OWNER TO postgres;

--
-- TOC entry 2922 (class 0 OID 0)
-- Dependencies: 218
-- Name: snooze_by_watch_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.snooze_by_watch_id_seq OWNED BY public.snooze_by_watch.id;


--
-- TOC entry 206 (class 1259 OID 16844)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    name character varying(50),
    id bigint NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 207 (class 1259 OID 16847)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 2923 (class 0 OID 0)
-- Dependencies: 207
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 208 (class 1259 OID 16849)
-- Name: watches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.watches (
    price integer,
    item_id integer,
    user_id integer,
    id bigint NOT NULL,
    server character varying(10),
    datetime timestamp(6) without time zone,
    active boolean DEFAULT true,
    warned timestamp without time zone,
    auction_type text
);


ALTER TABLE public.watches OWNER TO postgres;

--
-- TOC entry 209 (class 1259 OID 16852)
-- Name: watches_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.watches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.watches_id_seq OWNER TO postgres;

--
-- TOC entry 2924 (class 0 OID 0)
-- Dependencies: 209
-- Name: watches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.watches_id_seq OWNED BY public.watches.id;


--
-- TOC entry 2744 (class 2604 OID 16923)
-- Name: blocked_seller_by_user id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_seller_by_user ALTER COLUMN id SET DEFAULT nextval('public.blocked_seller_by_user_id_seq'::regclass);


--
-- TOC entry 2747 (class 2604 OID 16998)
-- Name: blocked_seller_by_watch id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_seller_by_watch ALTER COLUMN id SET DEFAULT nextval('public.blocked_seller_by_watch_id_seq'::regclass);


--
-- TOC entry 2746 (class 2604 OID 16980)
-- Name: communication_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communication_history ALTER COLUMN id SET DEFAULT nextval('public.communication_history_id_seq'::regclass);


--
-- TOC entry 2739 (class 2604 OID 16854)
-- Name: items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items ALTER COLUMN id SET DEFAULT nextval('public.items_id_seq'::regclass);


--
-- TOC entry 2740 (class 2604 OID 16855)
-- Name: servers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers ALTER COLUMN id SET DEFAULT nextval('public.servers_id_seq'::regclass);


--
-- TOC entry 2745 (class 2604 OID 16936)
-- Name: snooze_by_user id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.snooze_by_user ALTER COLUMN id SET DEFAULT nextval('public.snooze_by_user_id_seq'::regclass);


--
-- TOC entry 2748 (class 2604 OID 17016)
-- Name: snooze_by_watch id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.snooze_by_watch ALTER COLUMN id SET DEFAULT nextval('public.snooze_by_watch_id_seq'::regclass);


--
-- TOC entry 2741 (class 2604 OID 16856)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 2742 (class 2604 OID 16857)
-- Name: watches id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watches ALTER COLUMN id SET DEFAULT nextval('public.watches_id_seq'::regclass);


--
-- TOC entry 2760 (class 2606 OID 16925)
-- Name: blocked_seller_by_user blocked_seller_by_user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_seller_by_user
    ADD CONSTRAINT blocked_seller_by_user_pkey PRIMARY KEY (id);


--
-- TOC entry 2772 (class 2606 OID 17003)
-- Name: blocked_seller_by_watch blocked_seller_by_watch_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_seller_by_watch
    ADD CONSTRAINT blocked_seller_by_watch_pkey PRIMARY KEY (id);


--
-- TOC entry 2774 (class 2606 OID 17005)
-- Name: blocked_seller_by_watch blocked_seller_by_watch_watch_id_seller_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_seller_by_watch
    ADD CONSTRAINT blocked_seller_by_watch_watch_id_seller_key UNIQUE (watch_id, seller);


--
-- TOC entry 2768 (class 2606 OID 16985)
-- Name: communication_history communication_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communication_history
    ADD CONSTRAINT communication_history_pkey PRIMARY KEY (id);


--
-- TOC entry 2770 (class 2606 OID 16987)
-- Name: communication_history communication_history_watch_id_seller_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communication_history
    ADD CONSTRAINT communication_history_watch_id_seller_key UNIQUE (watch_id, seller);


--
-- TOC entry 2750 (class 2606 OID 16859)
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- TOC entry 2752 (class 2606 OID 16861)
-- Name: servers servers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_pkey PRIMARY KEY (id);


--
-- TOC entry 2764 (class 2606 OID 16938)
-- Name: snooze_by_user snooze_by_user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.snooze_by_user
    ADD CONSTRAINT snooze_by_user_pkey PRIMARY KEY (id);


--
-- TOC entry 2766 (class 2606 OID 16940)
-- Name: snooze_by_user snooze_by_user_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.snooze_by_user
    ADD CONSTRAINT snooze_by_user_user_id_key UNIQUE (user_id);


--
-- TOC entry 2776 (class 2606 OID 17018)
-- Name: snooze_by_watch snooze_by_watch_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.snooze_by_watch
    ADD CONSTRAINT snooze_by_watch_pkey PRIMARY KEY (id);


--
-- TOC entry 2762 (class 2606 OID 17188)
-- Name: blocked_seller_by_user unique_user_seller_server; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_seller_by_user
    ADD CONSTRAINT unique_user_seller_server UNIQUE (user_id, server, seller);


--
-- TOC entry 2754 (class 2606 OID 16863)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 2778 (class 2606 OID 17020)
-- Name: snooze_by_watch watch_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.snooze_by_watch
    ADD CONSTRAINT watch_id_unique UNIQUE (watch_id);


--
-- TOC entry 2758 (class 2606 OID 16865)
-- Name: watches watches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watches
    ADD CONSTRAINT watches_pkey PRIMARY KEY (id);


--
-- TOC entry 2755 (class 1259 OID 16866)
-- Name: fki_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX fki_item_id ON public.watches USING btree (item_id);


--
-- TOC entry 2756 (class 1259 OID 16867)
-- Name: fki_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX fki_user_id ON public.watches USING btree (user_id);


--
-- TOC entry 2783 (class 2606 OID 17006)
-- Name: blocked_seller_by_watch blocked_seller_by_watch_watch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_seller_by_watch
    ADD CONSTRAINT blocked_seller_by_watch_watch_id_fkey FOREIGN KEY (watch_id) REFERENCES public.watches(id);


--
-- TOC entry 2782 (class 2606 OID 16988)
-- Name: communication_history communication_history_watch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communication_history
    ADD CONSTRAINT communication_history_watch_id_fkey FOREIGN KEY (watch_id) REFERENCES public.watches(id) ON DELETE CASCADE;


--
-- TOC entry 2779 (class 2606 OID 16868)
-- Name: watches item_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watches
    ADD CONSTRAINT item_id FOREIGN KEY (item_id) REFERENCES public.items(id) NOT VALID;


--
-- TOC entry 2780 (class 2606 OID 16873)
-- Name: watches user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watches
    ADD CONSTRAINT user_id FOREIGN KEY (user_id) REFERENCES public.users(id) NOT VALID;


--
-- TOC entry 2781 (class 2606 OID 16926)
-- Name: blocked_seller_by_user user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_seller_by_user
    ADD CONSTRAINT user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 2784 (class 2606 OID 17021)
-- Name: snooze_by_watch watch_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.snooze_by_watch
    ADD CONSTRAINT watch_id FOREIGN KEY (watch_id) REFERENCES public.watches(id) ON DELETE CASCADE;


-- Completed on 2022-06-10 03:22:06

--
-- PostgreSQL database dump complete
--


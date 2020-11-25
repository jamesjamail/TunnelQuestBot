--
-- PostgreSQL database dump
--

-- Dumped from database version 12.1
-- Dumped by pg_dump version 12.1

-- Started on 2020-10-18 23:03:54

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
-- TOC entry 211 (class 1259 OID 16590)
-- Name: blocked_seller_by_user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blocked_seller_by_user (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    seller text NOT NULL,
    server text NOT NULL
);


ALTER TABLE public.blocked_seller_by_user OWNER TO postgres;

--
-- TOC entry 210 (class 1259 OID 16588)
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
-- TOC entry 2932 (class 0 OID 0)
-- Dependencies: 210
-- Name: blocked_seller_by_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.blocked_seller_by_user_id_seq OWNED BY public.blocked_seller_by_user.id;


--
-- TOC entry 217 (class 1259 OID 16652)
-- Name: blocked_seller_by_watch; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blocked_seller_by_watch (
    id bigint NOT NULL,
    watch_id bigint NOT NULL,
    seller text NOT NULL
);


ALTER TABLE public.blocked_seller_by_watch OWNER TO postgres;

--
-- TOC entry 216 (class 1259 OID 16650)
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
-- TOC entry 2933 (class 0 OID 0)
-- Dependencies: 216
-- Name: blocked_seller_by_watch_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.blocked_seller_by_watch_id_seq OWNED BY public.blocked_seller_by_watch.id;


--
-- TOC entry 219 (class 1259 OID 16670)
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
-- TOC entry 218 (class 1259 OID 16668)
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
-- TOC entry 2934 (class 0 OID 0)
-- Dependencies: 218
-- Name: communication_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.communication_history_id_seq OWNED BY public.communication_history.id;


--
-- TOC entry 202 (class 1259 OID 16394)
-- Name: items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.items (
    name character varying(99),
    id bigint NOT NULL
);


ALTER TABLE public.items OWNER TO postgres;

--
-- TOC entry 205 (class 1259 OID 16424)
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
-- TOC entry 2935 (class 0 OID 0)
-- Dependencies: 205
-- Name: items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.items_id_seq OWNED BY public.items.id;


--
-- TOC entry 209 (class 1259 OID 16471)
-- Name: servers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.servers (
    name character varying,
    id bigint NOT NULL
);


ALTER TABLE public.servers OWNER TO postgres;

--
-- TOC entry 208 (class 1259 OID 16469)
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
-- TOC entry 2936 (class 0 OID 0)
-- Dependencies: 208
-- Name: servers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.servers_id_seq OWNED BY public.servers.id;


--
-- TOC entry 213 (class 1259 OID 16621)
-- Name: snooze_by_user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.snooze_by_user (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    expiration timestamp without time zone NOT NULL
);


ALTER TABLE public.snooze_by_user OWNER TO postgres;

--
-- TOC entry 212 (class 1259 OID 16619)
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
-- TOC entry 2937 (class 0 OID 0)
-- Dependencies: 212
-- Name: snooze_by_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.snooze_by_user_id_seq OWNED BY public.snooze_by_user.id;


--
-- TOC entry 215 (class 1259 OID 16635)
-- Name: snooze_by_watch; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.snooze_by_watch (
    id bigint NOT NULL,
    watch_id bigint NOT NULL,
    expiration timestamp without time zone NOT NULL
);


ALTER TABLE public.snooze_by_watch OWNER TO postgres;

--
-- TOC entry 214 (class 1259 OID 16633)
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
-- TOC entry 2938 (class 0 OID 0)
-- Dependencies: 214
-- Name: snooze_by_watch_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.snooze_by_watch_id_seq OWNED BY public.snooze_by_watch.id;


--
-- TOC entry 204 (class 1259 OID 16413)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    name character varying(50),
    id bigint NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 206 (class 1259 OID 16432)
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
-- TOC entry 2939 (class 0 OID 0)
-- Dependencies: 206
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 203 (class 1259 OID 16399)
-- Name: watches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.watches (
    price integer,
    item_id integer,
    user_id integer,
    id bigint NOT NULL,
    server character varying(10),
    datetime timestamp(6) without time zone,
    active boolean DEFAULT true
);


ALTER TABLE public.watches OWNER TO postgres;

--
-- TOC entry 207 (class 1259 OID 16440)
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
-- TOC entry 2940 (class 0 OID 0)
-- Dependencies: 207
-- Name: watches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.watches_id_seq OWNED BY public.watches.id;


--
-- TOC entry 2744 (class 2604 OID 16593)
-- Name: blocked_seller_by_user id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_seller_by_user ALTER COLUMN id SET DEFAULT nextval('public.blocked_seller_by_user_id_seq'::regclass);


--
-- TOC entry 2747 (class 2604 OID 16655)
-- Name: blocked_seller_by_watch id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_seller_by_watch ALTER COLUMN id SET DEFAULT nextval('public.blocked_seller_by_watch_id_seq'::regclass);


--
-- TOC entry 2748 (class 2604 OID 16673)
-- Name: communication_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communication_history ALTER COLUMN id SET DEFAULT nextval('public.communication_history_id_seq'::regclass);


--
-- TOC entry 2739 (class 2604 OID 16426)
-- Name: items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items ALTER COLUMN id SET DEFAULT nextval('public.items_id_seq'::regclass);


--
-- TOC entry 2743 (class 2604 OID 16474)
-- Name: servers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers ALTER COLUMN id SET DEFAULT nextval('public.servers_id_seq'::regclass);


--
-- TOC entry 2745 (class 2604 OID 16624)
-- Name: snooze_by_user id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.snooze_by_user ALTER COLUMN id SET DEFAULT nextval('public.snooze_by_user_id_seq'::regclass);


--
-- TOC entry 2746 (class 2604 OID 16638)
-- Name: snooze_by_watch id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.snooze_by_watch ALTER COLUMN id SET DEFAULT nextval('public.snooze_by_watch_id_seq'::regclass);


--
-- TOC entry 2742 (class 2604 OID 16434)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 2740 (class 2604 OID 16442)
-- Name: watches id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watches ALTER COLUMN id SET DEFAULT nextval('public.watches_id_seq'::regclass);


--
-- TOC entry 2760 (class 2606 OID 16598)
-- Name: blocked_seller_by_user blocked_seller_by_user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_seller_by_user
    ADD CONSTRAINT blocked_seller_by_user_pkey PRIMARY KEY (id);


--
-- TOC entry 2771 (class 2606 OID 16660)
-- Name: blocked_seller_by_watch blocked_seller_by_watch_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_seller_by_watch
    ADD CONSTRAINT blocked_seller_by_watch_pkey PRIMARY KEY (id);


--
-- TOC entry 2773 (class 2606 OID 16678)
-- Name: communication_history communication_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communication_history
    ADD CONSTRAINT communication_history_pkey PRIMARY KEY (id);


--
-- TOC entry 2775 (class 2606 OID 16680)
-- Name: communication_history communication_history_watch_id_seller_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communication_history
    ADD CONSTRAINT communication_history_watch_id_seller_key UNIQUE (watch_id) INCLUDE (seller);


--
-- TOC entry 2750 (class 2606 OID 16431)
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- TOC entry 2758 (class 2606 OID 16479)
-- Name: servers servers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_pkey PRIMARY KEY (id);


--
-- TOC entry 2763 (class 2606 OID 16626)
-- Name: snooze_by_user snooze_by_user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.snooze_by_user
    ADD CONSTRAINT snooze_by_user_pkey PRIMARY KEY (id);


--
-- TOC entry 2765 (class 2606 OID 16649)
-- Name: snooze_by_user snooze_by_user_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.snooze_by_user
    ADD CONSTRAINT snooze_by_user_user_id_key UNIQUE (user_id);


--
-- TOC entry 2767 (class 2606 OID 16640)
-- Name: snooze_by_watch snooze_by_watch_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.snooze_by_watch
    ADD CONSTRAINT snooze_by_watch_pkey PRIMARY KEY (id);


--
-- TOC entry 2769 (class 2606 OID 16647)
-- Name: snooze_by_watch snooze_by_watch_watch_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.snooze_by_watch
    ADD CONSTRAINT snooze_by_watch_watch_id_key UNIQUE (watch_id);


--
-- TOC entry 2756 (class 2606 OID 16439)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 2754 (class 2606 OID 16452)
-- Name: watches watches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watches
    ADD CONSTRAINT watches_pkey PRIMARY KEY (id);


--
-- TOC entry 2761 (class 1259 OID 16606)
-- Name: blocked_seller_by_user_user_id_seller_server_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX blocked_seller_by_user_user_id_seller_server_unique ON public.blocked_seller_by_user USING btree (user_id, seller, server);


--
-- TOC entry 2751 (class 1259 OID 16412)
-- Name: fki_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX fki_item_id ON public.watches USING btree (item_id);


--
-- TOC entry 2752 (class 1259 OID 16423)
-- Name: fki_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX fki_user_id ON public.watches USING btree (user_id);


--
-- TOC entry 2778 (class 2606 OID 16601)
-- Name: blocked_seller_by_user blocked_seller_by_user_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_seller_by_user
    ADD CONSTRAINT blocked_seller_by_user_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;


--
-- TOC entry 2781 (class 2606 OID 16663)
-- Name: blocked_seller_by_watch blocked_seller_by_watch_watch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_seller_by_watch
    ADD CONSTRAINT blocked_seller_by_watch_watch_id_fkey FOREIGN KEY (watch_id) REFERENCES public.watches(id);


--
-- TOC entry 2782 (class 2606 OID 16681)
-- Name: communication_history communication_history_watch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communication_history
    ADD CONSTRAINT communication_history_watch_id_fkey FOREIGN KEY (watch_id) REFERENCES public.watches(id) ON DELETE CASCADE;


--
-- TOC entry 2776 (class 2606 OID 16453)
-- Name: watches item_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watches
    ADD CONSTRAINT item_id FOREIGN KEY (item_id) REFERENCES public.items(id) NOT VALID;


--
-- TOC entry 2779 (class 2606 OID 16627)
-- Name: snooze_by_user snooze_by_user_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.snooze_by_user
    ADD CONSTRAINT snooze_by_user_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) NOT VALID;


--
-- TOC entry 2780 (class 2606 OID 16641)
-- Name: snooze_by_watch snooze_by_watch_watch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.snooze_by_watch
    ADD CONSTRAINT snooze_by_watch_watch_id_fkey FOREIGN KEY (watch_id) REFERENCES public.watches(id);


--
-- TOC entry 2777 (class 2606 OID 16458)
-- Name: watches user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.watches
    ADD CONSTRAINT user_id FOREIGN KEY (user_id) REFERENCES public.users(id) NOT VALID;


-- Completed on 2020-10-18 23:03:54

--
-- PostgreSQL database dump complete
--


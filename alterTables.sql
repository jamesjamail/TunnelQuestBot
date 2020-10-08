
--add active column to watches, setting existing watches as true (will be fine since old watches are deleted)
ALTER TABLE public.watches
    ADD COLUMN active boolean DEFAULT true;

--add communication history table
CREATE TABLE public.communication_history
(
    id bigint NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    watch_id bigint,
    seller character varying(30) COLLATE pg_catalog."default",
    CONSTRAINT communication_history_pkey PRIMARY KEY (id),
    CONSTRAINT watch_id_seller UNIQUE (watch_id)
        INCLUDE(seller),
    CONSTRAINT watch_id FOREIGN KEY (watch_id)
        REFERENCES public.watches (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
        NOT VALID
)

TABLESPACE pg_default;

ALTER TABLE public.communication_history
    OWNER to postgres;

-- DROP INDEX public.fki_watch_id;

CREATE INDEX fki_watch_id
    ON public.communication_history USING btree
    (watch_id)
    TABLESPACE pg_default;

-- add table blocked_seller_by_watch


CREATE TABLE public.blocked_seller_by_watch
(
    id bigint NOT NULL,
    watch_id bigint NOT NULL,
    seller character varying(30) COLLATE pg_catalog."default" NOT NULL,
    server character varying(10) COLLATE pg_catalog."default",
    CONSTRAINT blocked_seller_by_watch_pkey PRIMARY KEY (id),
    CONSTRAINT watch_id FOREIGN KEY (watch_id)
        REFERENCES public.watches (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
)

TABLESPACE pg_default;

ALTER TABLE public.blocked_seller_by_watch
    OWNER to postgres;

-- add table blocked_seller_by_user

CREATE TABLE public.blocked_seller_by_user
(
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    server character varying(10) COLLATE pg_catalog."default",
    seller character varying(30) COLLATE pg_catalog."default" NOT NULL,
    CONSTRAINT blocked_seller_by_user_pkey PRIMARY KEY (id),
    CONSTRAINT user_id FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
)

TABLESPACE pg_default;

ALTER TABLE public.blocked_seller_by_user
    OWNER to postgres;

--add table snooze_by_user

CREATE TABLE public.snooze_by_user
(
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    expiration time without time zone NOT NULL,
    CONSTRAINT snooze_by_user_pkey PRIMARY KEY (id),
    CONSTRAINT user_id FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
)

TABLESPACE pg_default;

ALTER TABLE public.snooze_by_user
    OWNER to postgres;

--add table snooze_by_watch

CREATE TABLE public.snooze_by_watch
(
    id bigint NOT NULL,
    watch_id bigint NOT NULL,
    expiration time without time zone NOT NULL,
    CONSTRAINT snooze_by_watch_pkey PRIMARY KEY (id),
    CONSTRAINT watch_id_unique UNIQUE (watch_id)
        INCLUDE(watch_id),
    CONSTRAINT watch_id FOREIGN KEY (watch_id)
        REFERENCES public.watches (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
)

TABLESPACE pg_default;

ALTER TABLE public.snooze_by_watch
    OWNER to postgres;


    CREATE TABLE public.snooze_by_user
(
    id bigserial NOT NULL,
    user_id bigint NOT NULL,
    expiration time without time zone NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (user_id)

);

ALTER TABLE public.snooze_by_user
    OWNER to postgres;


--dont forget snooze_by_user

--...

ALTER TABLE public.snooze_by_user
    ADD UNIQUE (user_id);


    CREATE TABLE public.snooze_by_watch
(
    id bigserial NOT NULL,
    watch_id bigint NOT NULL,
    expiration timestamp without time zone NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (watch_id)
        REFERENCES public.watches (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID
);
--dont forget to add unique

ALTER TABLE public.snooze_by_watch
    OWNER to postgres;


    CREATE TABLE public.blocked_seller_by_watch
(
    id bigserial NOT NULL,
    watch_id bigint NOT NULL,
    seller text NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (watch_id)
        INCLUDE(seller, server),
    FOREIGN KEY (watch_id)
        REFERENCES public.watches (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID
);

ALTER TABLE public.blocked_seller_by_watch
    OWNER to postgres;
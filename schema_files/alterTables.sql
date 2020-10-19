--make changes to db for future features...
ALTER TABLE public.watches
--add active column to watches, setting existing watches as true (will be fine since old watches are deleted)
    ADD COLUMN active boolean DEFAULT true,
--add warned timestamp for the 'warn a user 1 day before their watch expires' feature (to be implemented)
    ADD COLUMN warned timestamp without time zone DEFAULT false,
--add auction type column for wts/wtb/all feature (to be implmenented)
    ADD COLUMN auction_type text;



--for 'debounce same item/seller in a 15 minute window feature'...
CREATE TABLE public.communication_history
(
    id bigserial NOT NULL,
    watch_id bigint NOT NULL,
    seller text NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (watch_id)
        INCLUDE(seller),
    FOREIGN KEY (watch_id)
        REFERENCES public.watches (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
        NOT VALID
);



--for blocking a seller based on item/watch...
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

--for blocking a seller across all watches/items...
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



--for snoozing a particular item/watch...
CREATE TABLE public.snooze_by_user
(
    id bigserial NOT NULL,
    user_id bigint NOT NULL,
    expiration time without time zone NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (user_id)

);


--for snoozing all watches/items...
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
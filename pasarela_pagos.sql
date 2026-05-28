--
-- PostgreSQL database dump
--

\restrict BSMLguT0T2Hyw5QE2uOhCxA56gGkbO9r5ZheIW99zfKVHBxdnOnf8ITmSIEuvkG

-- Dumped from database version 18.4 (Debian 18.4-1.pgdg12+1)
-- Dumped by pg_dump version 18.4 (Debian 18.4-1.pgdg12+1)

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
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: merchant_status; Type: TYPE; Schema: public; Owner: admin
--

CREATE TYPE public.merchant_status AS ENUM (
    'PENDING_KYC',
    'ACTIVE',
    'SUSPENDED',
    'BLOCKED'
);


ALTER TYPE public.merchant_status OWNER TO admin;

--
-- Name: transaction_status; Type: TYPE; Schema: public; Owner: admin
--

CREATE TYPE public.transaction_status AS ENUM (
    'PENDING',
    'PROCESSING',
    'SUCCESSFUL',
    'FAILED',
    'EXPIRED'
);


ALTER TYPE public.transaction_status OWNER TO admin;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: admin
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    merchant_id uuid NOT NULL,
    key_hash character varying(255) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    role character varying(20) DEFAULT 'merchant'::character varying NOT NULL
);


ALTER TABLE public.api_keys OWNER TO admin;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    merchant_id uuid,
    action character varying(100) NOT NULL,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO admin;

--
-- Name: merchants; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.merchants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    legal_name character varying(200) NOT NULL,
    nit character varying(20) NOT NULL,
    status public.merchant_status DEFAULT 'PENDING_KYC'::public.merchant_status NOT NULL,
    commission_scheme jsonb NOT NULL,
    webhook_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.merchants OWNER TO admin;

--
-- Name: settlement_details; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.settlement_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    settlement_run_id uuid NOT NULL,
    transaction_id uuid,
    merchant_id uuid,
    order_reference character varying(100),
    bank_transaction_id character varying(150),
    amount numeric(12,2) NOT NULL,
    commission_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    net_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    status character varying(30) NOT NULL,
    details text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.settlement_details OWNER TO admin;

--
-- Name: settlement_runs; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.settlement_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_date date NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    total_transactions integer DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    total_commission numeric(12,2) DEFAULT 0.00 NOT NULL,
    total_net_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    unreconciled_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.settlement_runs OWNER TO admin;

--
-- Name: transaction_events; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.transaction_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id uuid NOT NULL,
    from_status public.transaction_status,
    to_status public.transaction_status NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.transaction_events OWNER TO admin;

--
-- Name: transactions; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    merchant_id uuid NOT NULL,
    order_reference character varying(100) NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency character varying(3) DEFAULT 'BOB'::character varying NOT NULL,
    status public.transaction_status DEFAULT 'PENDING'::public.transaction_status NOT NULL,
    qr_payload text NOT NULL,
    bank_transaction_id character varying(150),
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.transactions OWNER TO admin;

--
-- Name: webhook_logs; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.webhook_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id uuid NOT NULL,
    attempt_number integer NOT NULL,
    http_status integer,
    response_payload text,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.webhook_logs OWNER TO admin;

--
-- Data for Name: api_keys; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.api_keys (id, merchant_id, key_hash, is_active, created_at, updated_at, expires_at, role) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.audit_logs (id, merchant_id, action, payload, created_at) FROM stdin;
\.


--
-- Data for Name: merchants; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.merchants (id, legal_name, nit, status, commission_scheme, webhook_url, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: settlement_details; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.settlement_details (id, settlement_run_id, transaction_id, merchant_id, order_reference, bank_transaction_id, amount, commission_amount, net_amount, status, details, created_at) FROM stdin;
\.


--
-- Data for Name: settlement_runs; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.settlement_runs (id, run_date, status, total_transactions, total_amount, total_commission, total_net_amount, unreconciled_count, created_at) FROM stdin;
\.


--
-- Data for Name: transaction_events; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.transaction_events (id, transaction_id, from_status, to_status, description, created_at) FROM stdin;
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.transactions (id, merchant_id, order_reference, amount, currency, status, qr_payload, bank_transaction_id, expires_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: webhook_logs; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.webhook_logs (id, transaction_id, attempt_number, http_status, response_payload, delivered_at, created_at) FROM stdin;
\.


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: merchants merchants_nit_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.merchants
    ADD CONSTRAINT merchants_nit_key UNIQUE (nit);


--
-- Name: merchants merchants_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.merchants
    ADD CONSTRAINT merchants_pkey PRIMARY KEY (id);


--
-- Name: settlement_details settlement_details_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.settlement_details
    ADD CONSTRAINT settlement_details_pkey PRIMARY KEY (id);


--
-- Name: settlement_runs settlement_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.settlement_runs
    ADD CONSTRAINT settlement_runs_pkey PRIMARY KEY (id);


--
-- Name: settlement_runs settlement_runs_run_date_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.settlement_runs
    ADD CONSTRAINT settlement_runs_run_date_key UNIQUE (run_date);


--
-- Name: transaction_events transaction_events_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.transaction_events
    ADD CONSTRAINT transaction_events_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: transactions unique_merchant_active_order; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT unique_merchant_active_order UNIQUE (merchant_id, order_reference);


--
-- Name: webhook_logs webhook_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_pkey PRIMARY KEY (id);


--
-- Name: idx_api_keys_merchant_active; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_api_keys_merchant_active ON public.api_keys USING btree (merchant_id) WHERE (is_active = true);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_merchant; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_audit_logs_merchant ON public.audit_logs USING btree (merchant_id) WHERE (merchant_id IS NOT NULL);


--
-- Name: idx_merchants_status; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_merchants_status ON public.merchants USING btree (status);


--
-- Name: idx_settlement_details_merchant; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_settlement_details_merchant ON public.settlement_details USING btree (merchant_id);


--
-- Name: idx_settlement_details_run; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_settlement_details_run ON public.settlement_details USING btree (settlement_run_id);


--
-- Name: idx_transaction_events_tx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_transaction_events_tx ON public.transaction_events USING btree (transaction_id);


--
-- Name: idx_transactions_bank_tx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_transactions_bank_tx ON public.transactions USING btree (bank_transaction_id) WHERE (bank_transaction_id IS NOT NULL);


--
-- Name: idx_transactions_merchant; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_transactions_merchant ON public.transactions USING btree (merchant_id);


--
-- Name: idx_transactions_status; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_transactions_status ON public.transactions USING btree (status);


--
-- Name: idx_webhook_logs_tx; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_webhook_logs_tx ON public.webhook_logs USING btree (transaction_id);


--
-- Name: api_keys trigger_update_api_keys_updated_at; Type: TRIGGER; Schema: public; Owner: admin
--

CREATE TRIGGER trigger_update_api_keys_updated_at BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: merchants trigger_update_merchants_updated_at; Type: TRIGGER; Schema: public; Owner: admin
--

CREATE TRIGGER trigger_update_merchants_updated_at BEFORE UPDATE ON public.merchants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: transactions trigger_update_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: admin
--

CREATE TRIGGER trigger_update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: api_keys api_keys_merchant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_merchant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE SET NULL;


--
-- Name: settlement_details settlement_details_merchant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.settlement_details
    ADD CONSTRAINT settlement_details_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE SET NULL;


--
-- Name: settlement_details settlement_details_settlement_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.settlement_details
    ADD CONSTRAINT settlement_details_settlement_run_id_fkey FOREIGN KEY (settlement_run_id) REFERENCES public.settlement_runs(id) ON DELETE CASCADE;


--
-- Name: settlement_details settlement_details_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.settlement_details
    ADD CONSTRAINT settlement_details_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;


--
-- Name: transaction_events transaction_events_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.transaction_events
    ADD CONSTRAINT transaction_events_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_merchant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE RESTRICT;


--
-- Name: webhook_logs webhook_logs_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict BSMLguT0T2Hyw5QE2uOhCxA56gGkbO9r5ZheIW99zfKVHBxdnOnf8ITmSIEuvkG


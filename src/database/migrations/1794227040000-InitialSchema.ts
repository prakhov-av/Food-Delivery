import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1794227040000 implements MigrationInterface {
  public readonly name = 'InitialSchema1794227040000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE public.orders_order_status_enum AS ENUM ( 'NEW', 'ACCEPTED', 'COOKING', 'READY', 'DELIVERING', 'COMPLETED', 'CANCELLED_CUSTOMER', 'CANCELLED_COURIER', 'CANCELLED_STAFF' )`);
    await queryRunner.query(`CREATE TYPE public.users_role_enum AS ENUM ( 'ADMIN', 'MANAGER', 'CUSTOMER', 'COURIER' )`);
    await queryRunner.query(`CREATE TABLE public.audit_logs ( id integer NOT NULL, created_at timestamp without time zone DEFAULT now() NOT NULL, actor_id integer, actor_role character varying(20), action character varying(40) NOT NULL, entity_type character varying(40), entity_id integer, result character varying(10) NOT NULL, ip character varying(64), user_agent character varying(255), details jsonb )`);
    await queryRunner.query(`CREATE SEQUENCE public.audit_logs_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1`);
    await queryRunner.query(`ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id`);
    await queryRunner.query(`CREATE TABLE public.chat_logs ( id integer NOT NULL, created_at timestamp without time zone DEFAULT now() NOT NULL, user_id integer NOT NULL, user_role character varying(20) NOT NULL, question text NOT NULL, answer text, kind character varying(20) NOT NULL, document_type character varying(20), chunks_found integer )`);
    await queryRunner.query(`CREATE SEQUENCE public.chat_logs_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1`);
    await queryRunner.query(`ALTER SEQUENCE public.chat_logs_id_seq OWNED BY public.chat_logs.id`);
    await queryRunner.query(`CREATE TABLE public.confirmation_codes ( id integer NOT NULL, value character varying NOT NULL, expiration timestamp without time zone NOT NULL, user_id integer NOT NULL )`);
    await queryRunner.query(`CREATE SEQUENCE public.confirmation_codes_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1`);
    await queryRunner.query(`ALTER SEQUENCE public.confirmation_codes_id_seq OWNED BY public.confirmation_codes.id`);
    await queryRunner.query(`CREATE TABLE public.menu_items ( id integer NOT NULL, name character varying NOT NULL, description character varying NOT NULL, price numeric(10,2) NOT NULL, active boolean DEFAULT true NOT NULL, menu_id integer )`);
    await queryRunner.query(`CREATE SEQUENCE public.menu_items_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1`);
    await queryRunner.query(`ALTER SEQUENCE public.menu_items_id_seq OWNED BY public.menu_items.id`);
    await queryRunner.query(`CREATE TABLE public.menus ( id integer NOT NULL, name character varying NOT NULL, active boolean DEFAULT true NOT NULL, restaurant_id integer )`);
    await queryRunner.query(`CREATE SEQUENCE public.menus_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1`);
    await queryRunner.query(`ALTER SEQUENCE public.menus_id_seq OWNED BY public.menus.id`);
    await queryRunner.query(`CREATE TABLE public.order_items ( id integer NOT NULL, quantity integer NOT NULL, active boolean DEFAULT true NOT NULL, order_id integer, menu_item_id integer )`);
    await queryRunner.query(`CREATE SEQUENCE public.order_items_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1`);
    await queryRunner.query(`ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id`);
    await queryRunner.query(`CREATE TABLE public.orders ( id integer NOT NULL, order_status public.orders_order_status_enum NOT NULL, total_price numeric(10,2) NOT NULL, created_at timestamp without time zone DEFAULT now() NOT NULL, active boolean DEFAULT true NOT NULL, customer_id integer NOT NULL, courier_id integer, restaurant_id integer NOT NULL )`);
    await queryRunner.query(`CREATE SEQUENCE public.orders_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1`);
    await queryRunner.query(`ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id`);
    await queryRunner.query(`CREATE TABLE public.quarantine_documents ( id integer NOT NULL, document_id character varying NOT NULL, text character varying NOT NULL, reason character varying NOT NULL )`);
    await queryRunner.query(`CREATE SEQUENCE public.quarantine_documents_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1`);
    await queryRunner.query(`ALTER SEQUENCE public.quarantine_documents_id_seq OWNED BY public.quarantine_documents.id`);
    await queryRunner.query(`CREATE TABLE public.restaurants ( id integer NOT NULL, name character varying NOT NULL, address character varying NOT NULL, phone character varying NOT NULL, email character varying NOT NULL, active boolean DEFAULT true NOT NULL )`);
    await queryRunner.query(`CREATE SEQUENCE public.restaurants_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1`);
    await queryRunner.query(`ALTER SEQUENCE public.restaurants_id_seq OWNED BY public.restaurants.id`);
    await queryRunner.query(`CREATE TABLE public.users ( id integer NOT NULL, name character varying NOT NULL, password character varying NOT NULL, email character varying NOT NULL, phone character varying NOT NULL, role public.users_role_enum NOT NULL, created_at timestamp without time zone DEFAULT now() NOT NULL, deleted_at timestamp without time zone, active boolean NOT NULL )`);
    await queryRunner.query(`CREATE SEQUENCE public.users_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1`);
    await queryRunner.query(`ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id`);
    await queryRunner.query(`ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass)`);
    await queryRunner.query(`ALTER TABLE ONLY public.chat_logs ALTER COLUMN id SET DEFAULT nextval('public.chat_logs_id_seq'::regclass)`);
    await queryRunner.query(`ALTER TABLE ONLY public.confirmation_codes ALTER COLUMN id SET DEFAULT nextval('public.confirmation_codes_id_seq'::regclass)`);
    await queryRunner.query(`ALTER TABLE ONLY public.menu_items ALTER COLUMN id SET DEFAULT nextval('public.menu_items_id_seq'::regclass)`);
    await queryRunner.query(`ALTER TABLE ONLY public.menus ALTER COLUMN id SET DEFAULT nextval('public.menus_id_seq'::regclass)`);
    await queryRunner.query(`ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass)`);
    await queryRunner.query(`ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass)`);
    await queryRunner.query(`ALTER TABLE ONLY public.quarantine_documents ALTER COLUMN id SET DEFAULT nextval('public.quarantine_documents_id_seq'::regclass)`);
    await queryRunner.query(`ALTER TABLE ONLY public.restaurants ALTER COLUMN id SET DEFAULT nextval('public.restaurants_id_seq'::regclass)`);
    await queryRunner.query(`ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass)`);
    await queryRunner.query(`ALTER TABLE ONLY public.order_items ADD CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.audit_logs ADD CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.menus ADD CONSTRAINT "PK_3fec3d93327f4538e0cbd4349c4" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.chat_logs ADD CONSTRAINT "PK_41cbf85ffe164be478d02038601" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.menu_items ADD CONSTRAINT "PK_57e6188f929e5dc6919168620c8" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.orders ADD CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.quarantine_documents ADD CONSTRAINT "PK_83c300e78c5ba47ff3b42273114" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.users ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.confirmation_codes ADD CONSTRAINT "PK_a69728afe2297548351199d8984" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.restaurants ADD CONSTRAINT "PK_e2133a72eb1cc8f588f7b503e68" PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.menus ADD CONSTRAINT "REL_bcd4a935c967cc9c20e770d1e6" UNIQUE (restaurant_id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.users ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email)`);
    await queryRunner.query(`ALTER TABLE ONLY public.users ADD CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE (phone)`);
    await queryRunner.query(`ALTER TABLE ONLY public.confirmation_codes ADD CONSTRAINT "UQ_c383c83c9d659466dc068ccc54f" UNIQUE (value)`);
    await queryRunner.query(`CREATE INDEX "IDX_177183f29f438c488b5e8510cd" ON public.audit_logs USING btree (actor_id)`);
    await queryRunner.query(`CREATE INDEX "IDX_189e6c76afba4a5b6640e4fe56" ON public.chat_logs USING btree (user_id, created_at)`);
    await queryRunner.query(`CREATE INDEX "IDX_2cd10fda8276bb995288acfbfb" ON public.audit_logs USING btree (created_at)`);
    await queryRunner.query(`CREATE INDEX "IDX_cee5459245f652b75eb2759b4c" ON public.audit_logs USING btree (action)`);
    await queryRunner.query(`ALTER TABLE ONLY public.orders ADD CONSTRAINT "FK_0e0e0b6db50dc05c12031bce4c3" FOREIGN KEY (courier_id) REFERENCES public.users(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.order_items ADD CONSTRAINT "FK_145532db85752b29c57d2b7b1f1" FOREIGN KEY (order_id) REFERENCES public.orders(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.orders ADD CONSTRAINT "FK_772d0ce0473ac2ccfa26060dbe9" FOREIGN KEY (customer_id) REFERENCES public.users(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.orders ADD CONSTRAINT "FK_85fdda5fcce2f397ef8f117a2c6" FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.menu_items ADD CONSTRAINT "FK_ba71edc684a901b4bc9d9228f42" FOREIGN KEY (menu_id) REFERENCES public.menus(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.menus ADD CONSTRAINT "FK_bcd4a935c967cc9c20e770d1e62" FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.order_items ADD CONSTRAINT "FK_e462517174f561ece2916701c0a" FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id)`);
    await queryRunner.query(`ALTER TABLE ONLY public.confirmation_codes ADD CONSTRAINT "FK_fb179afebc1bcd8110f06ef51d3" FOREIGN KEY (user_id) REFERENCES public.users(id)`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error(
      'The initial schema migration is intentionally irreversible. Reverting it would destroy the application schema and data.',
    );
  }
}

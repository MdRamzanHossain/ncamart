CREATE TABLE "courier_location_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"courier" text NOT NULL,
	"geo_level" text NOT NULL,
	"geo_id" text NOT NULL,
	"courier_location_id" text NOT NULL,
	"courier_location_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"label" text DEFAULT 'HOME' NOT NULL,
	"consignee_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"division_id" text NOT NULL,
	"district_id" text NOT NULL,
	"thana_id" text NOT NULL,
	"area_id" text,
	"address_line" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "customer_ownership_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"full_name" text,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"delivered_order_count" integer DEFAULT 0 NOT NULL,
	"rto_count_12m" integer DEFAULT 0 NOT NULL,
	"cod_blocked" boolean DEFAULT false NOT NULL,
	"cod_block_reason" text,
	"cod_block_lifted_by" text,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"marketing_opt_in_at" timestamp with time zone,
	"preferred_locale" text DEFAULT 'bn' NOT NULL,
	"last_active_at" timestamp with time zone,
	"previous_customer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "geo_areas" (
	"id" text PRIMARY KEY NOT NULL,
	"thana_id" text NOT NULL,
	"name_en" text NOT NULL,
	"name_bn" text NOT NULL,
	"postal_code" text
);
--> statement-breakpoint
CREATE TABLE "geo_districts" (
	"id" text PRIMARY KEY NOT NULL,
	"division_id" text NOT NULL,
	"name_en" text NOT NULL,
	"name_bn" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_divisions" (
	"id" text PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_bn" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_thanas" (
	"id" text PRIMARY KEY NOT NULL,
	"district_id" text NOT NULL,
	"name_en" text NOT NULL,
	"name_bn" text NOT NULL,
	"is_inside_dhaka" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" char(64) NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"device_id" text,
	"device_label" text,
	"ip" text,
	"user_agent" text,
	"ownership_unconfirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" text,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret_enc" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_email_unique" UNIQUE("email"),
	CONSTRAINT "staff_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "staff_roles" (
	"staff_id" uuid NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "staff_roles_staff_id_role_pk" PRIMARY KEY("staff_id","role")
);
--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_ownership_challenges" ADD CONSTRAINT "customer_ownership_challenges_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_ownership_challenges" ADD CONSTRAINT "customer_ownership_challenges_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_areas" ADD CONSTRAINT "geo_areas_thana_id_geo_thanas_id_fk" FOREIGN KEY ("thana_id") REFERENCES "public"."geo_thanas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_districts" ADD CONSTRAINT "geo_districts_division_id_geo_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."geo_divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_thanas" ADD CONSTRAINT "geo_thanas_district_id_geo_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."geo_districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_courier_loc_unique" ON "courier_location_map" USING btree ("courier","geo_level","geo_id");--> statement-breakpoint
CREATE INDEX "idx_customer_addresses_customer_id" ON "customer_addresses" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_customer_default_address" ON "customer_addresses" USING btree ("customer_id") WHERE is_default = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_challenges_session" ON "customer_ownership_challenges" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_challenges_customer" ON "customer_ownership_challenges" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_customers_phone" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_customers_email" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_customers_status" ON "customers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_geo_areas_thana" ON "geo_areas" USING btree ("thana_id");--> statement-breakpoint
CREATE INDEX "idx_geo_districts_division" ON "geo_districts" USING btree ("division_id");--> statement-breakpoint
CREATE INDEX "idx_geo_thanas_district" ON "geo_thanas" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "idx_geo_thanas_inside_dhaka" ON "geo_thanas" USING btree ("is_inside_dhaka");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sessions_token_hash" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_sessions_subject" ON "sessions" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_staff_email" ON "staff" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_staff_phone" ON "staff" USING btree ("phone");
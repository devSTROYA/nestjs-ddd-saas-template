CREATE TABLE "login_challenges" (
	"id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"otp_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"status" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_login_challenges" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"principal_type" varchar(16) NOT NULL,
	"principal_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_refresh_tokens" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_login_challenges_email_pending" ON "login_challenges" USING btree ("email") WHERE "login_challenges"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_refresh_tokens_token_hash" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_family_id" ON "refresh_tokens" USING btree ("family_id");
CREATE TABLE "outbox" (
	"id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"tenant_id" uuid,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" varchar(1000),
	CONSTRAINT "pk_outbox" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE INDEX "idx_outbox_pending" ON "outbox" USING btree ("id") WHERE "outbox"."processed_at" is null;
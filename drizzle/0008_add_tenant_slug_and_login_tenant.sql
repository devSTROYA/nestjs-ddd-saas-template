DROP INDEX "uq_login_challenges_email_pending";--> statement-breakpoint
ALTER TABLE "login_challenges" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "slug" varchar(63);--> statement-breakpoint
UPDATE "tenants" SET "slug" = 'tenant-' || right(replace("id"::text, '-', ''), 12);--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "login_challenges" ADD CONSTRAINT "fk_login_challenges_tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "fk_refresh_tokens_tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_login_challenges_tenant_id_email_pending" ON "login_challenges" USING btree ("tenant_id","email") WHERE "login_challenges"."status" = 'pending' and "login_challenges"."tenant_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_login_challenges_tenant_id" ON "login_challenges" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_tenant_id" ON "refresh_tokens" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tenants_slug" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_login_challenges_email_pending" ON "login_challenges" USING btree ("email") WHERE "login_challenges"."status" = 'pending' and "login_challenges"."tenant_id" is null;
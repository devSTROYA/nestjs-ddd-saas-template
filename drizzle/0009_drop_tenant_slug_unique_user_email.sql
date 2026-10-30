DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "users" GROUP BY "email" HAVING count(*) > 1) THEN
		RAISE EXCEPTION 'Cannot make users.email unique: the same email belongs to users of several tenants, resolve them first';
	END IF;
END $$;--> statement-breakpoint
DROP INDEX "uq_tenants_slug";--> statement-breakpoint
DROP INDEX "uq_users_email_tenant_id";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email" ON "users" USING btree ("email");--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN "slug";
ALTER TABLE "workspace_members" ADD COLUMN "id" uuid;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
-- A member is an aggregate root now, so every row gets its own UUID v7 (built from the clock) and
-- the tenant of its workspace.
UPDATE "workspace_members" m
SET "id" = encode(set_bit(set_bit(overlay(uuid_send(gen_random_uuid()) PLACING substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3) FROM 1 FOR 6), 52, 1), 53, 1), 'hex')::uuid,
    "tenant_id" = w."tenant_id"
FROM "workspaces" w
WHERE w."id" = m."workspace_id";--> statement-breakpoint
ALTER TABLE "workspace_members" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_members" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "fk_workspace_members_tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_workspace_members_workspace_id_user_id" ON "workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_workspace_members_tenant_id" ON "workspace_members" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "workspace_members" DROP CONSTRAINT "pk_workspace_members";
--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "pk_workspace_members" PRIMARY KEY("id");

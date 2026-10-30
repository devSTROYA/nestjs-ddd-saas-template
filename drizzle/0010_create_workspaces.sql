CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_workspace_members" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_workspaces" PRIMARY KEY("id")
);
--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "fk_workspace_members_workspace_id" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "fk_workspace_members_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "fk_workspaces_tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_workspace_members_user_id" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_workspaces_tenant_id" ON "workspaces" USING btree ("tenant_id");--> statement-breakpoint
-- Existing tenants with users get a workspace named after them (the id is a UUID v7 built from the
-- clock), and every existing user, all created as tenant owners, becomes an owner of it. A tenant
-- without users gets none, because a workspace must have an owner.
INSERT INTO "workspaces" ("id", "tenant_id", "name")
SELECT encode(set_bit(set_bit(overlay(uuid_send(gen_random_uuid()) PLACING substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3) FROM 1 FOR 6), 52, 1), 53, 1), 'hex')::uuid, t."id", t."name"
FROM "tenants" t
WHERE EXISTS (SELECT 1 FROM "users" u WHERE u."tenant_id" = t."id");--> statement-breakpoint
INSERT INTO "workspace_members" ("workspace_id", "user_id", "role")
SELECT w."id", u."id", 'owner'
FROM "users" u
JOIN "workspaces" w ON w."tenant_id" = u."tenant_id";
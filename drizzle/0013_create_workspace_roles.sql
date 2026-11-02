CREATE TABLE "workspace_role_permissions" (
	"role_id" uuid NOT NULL,
	"permission" varchar(64) NOT NULL,
	CONSTRAINT "pk_workspace_role_permissions" PRIMARY KEY("role_id","permission")
);
--> statement-breakpoint
CREATE TABLE "workspace_roles" (
	"id" uuid NOT NULL,
	"tenant_id" uuid,
	"workspace_id" uuid,
	"key" varchar(32) NOT NULL,
	"name" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_workspace_roles" PRIMARY KEY("id"),
	CONSTRAINT "ck_workspace_roles_scope" CHECK (("workspace_roles"."tenant_id" is null) = ("workspace_roles"."workspace_id" is null))
);
--> statement-breakpoint
ALTER TABLE "workspace_role_permissions" ADD CONSTRAINT "fk_workspace_role_permissions_role_id" FOREIGN KEY ("role_id") REFERENCES "public"."workspace_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_roles" ADD CONSTRAINT "fk_workspace_roles_tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_roles" ADD CONSTRAINT "fk_workspace_roles_workspace_id" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_workspace_roles_workspace_id_key" ON "workspace_roles" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_workspace_roles_key_system" ON "workspace_roles" USING btree ("key") WHERE "workspace_roles"."workspace_id" is null;--> statement-breakpoint
CREATE INDEX "idx_workspace_roles_tenant_id" ON "workspace_roles" USING btree ("tenant_id");--> statement-breakpoint
-- System roles have no workspace and are shared by every workspace. The ids are fixed: the code
-- refers to them as SystemRoleId, so changing a system role's permissions takes a new migration.
INSERT INTO "workspace_roles" ("id", "key", "name") VALUES
	('00000000-0000-7000-8000-000000000001', 'owner', 'Owner'),
	('00000000-0000-7000-8000-000000000002', 'admin', 'Admin'),
	('00000000-0000-7000-8000-000000000003', 'member', 'Member');--> statement-breakpoint
INSERT INTO "workspace_role_permissions" ("role_id", "permission") VALUES
	('00000000-0000-7000-8000-000000000001', 'workspace-member:add'),
	('00000000-0000-7000-8000-000000000001', 'workspace-member:change-role'),
	('00000000-0000-7000-8000-000000000001', 'workspace-member:remove'),
	('00000000-0000-7000-8000-000000000001', 'workspace-role:manage'),
	('00000000-0000-7000-8000-000000000002', 'workspace-member:add'),
	('00000000-0000-7000-8000-000000000002', 'workspace-member:change-role'),
	('00000000-0000-7000-8000-000000000002', 'workspace-member:remove');--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "role_id" uuid;--> statement-breakpoint
-- Every existing member holds a system role; SET NOT NULL below stops the migration if one does not.
UPDATE "workspace_members" m
SET "role_id" = r."id"
FROM "workspace_roles" r
WHERE r."workspace_id" IS NULL AND r."key" = m."role";--> statement-breakpoint
ALTER TABLE "workspace_members" ALTER COLUMN "role_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "fk_workspace_members_role_id" FOREIGN KEY ("role_id") REFERENCES "public"."workspace_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_workspace_members_role_id" ON "workspace_members" USING btree ("role_id");

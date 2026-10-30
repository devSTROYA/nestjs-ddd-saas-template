ALTER TABLE "admins" RENAME CONSTRAINT "admins_pkey" TO "pk_admins";--> statement-breakpoint
ALTER TABLE "invitations" RENAME CONSTRAINT "invitations_pkey" TO "pk_invitations";--> statement-breakpoint
ALTER TABLE "tenants" RENAME CONSTRAINT "tenants_pkey" TO "pk_tenants";--> statement-breakpoint
ALTER TABLE "users" RENAME CONSTRAINT "users_pkey" TO "pk_users";--> statement-breakpoint
ALTER TABLE "invitations" RENAME CONSTRAINT "invitations_invited_by_admins_id_fk" TO "fk_invitations_invited_by";--> statement-breakpoint
ALTER TABLE "users" RENAME CONSTRAINT "users_tenant_id_tenants_id_fk" TO "fk_users_tenant_id";--> statement-breakpoint
ALTER INDEX "uq_invitations_pending_email" RENAME TO "uq_invitations_email_pending";--> statement-breakpoint
CREATE INDEX "idx_invitations_invited_by" ON "invitations" USING btree ("invited_by");--> statement-breakpoint
CREATE INDEX "idx_users_tenant_id" ON "users" USING btree ("tenant_id");

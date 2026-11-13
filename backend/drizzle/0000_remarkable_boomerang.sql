CREATE TABLE "chat_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_user_id" uuid NOT NULL,
	"orqspace_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"ended_at" timestamp,
	"ended_by_user_id" uuid,
	"client_cleared_before" timestamp,
	"workspace_cleared_before" timestamp,
	"last_message_preview" text,
	"last_message_at" timestamp,
	"unread_by_client" integer DEFAULT 0 NOT NULL,
	"unread_by_workspace" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"attachment_type" varchar(20) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(100),
	"size_bytes" integer,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"location_data" jsonb,
	"expires_at" timestamp NOT NULL,
	"is_expired" boolean DEFAULT false NOT NULL,
	"expired_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_message_id" uuid,
	"last_read_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"sender_side" varchar(20) NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"message_type" varchar(20) DEFAULT 'text' NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"status" varchar(20) DEFAULT 'delivered' NOT NULL,
	"is_edited" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp,
	"deleted_for_everyone" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" varchar(20) DEFAULT 'web' NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_push_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "orq_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" varchar(100),
	"email" varchar(255),
	"avatar" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orq_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "orqspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orqspace_id" varchar(14) NOT NULL,
	"name" varchar(150) NOT NULL,
	"logo_url" varchar(500),
	"owner_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orqspaces_orqspace_id_unique" UNIQUE("orqspace_id")
);
--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_client_user_id_orq_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "public"."orq_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_orqspace_id_orqspaces_id_fk" FOREIGN KEY ("orqspace_id") REFERENCES "public"."orqspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_ended_by_user_id_orq_users_id_fk" FOREIGN KEY ("ended_by_user_id") REFERENCES "public"."orq_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_attachments" ADD CONSTRAINT "chat_message_attachments_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_receipts" ADD CONSTRAINT "chat_message_receipts_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_receipts" ADD CONSTRAINT "chat_message_receipts_user_id_orq_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."orq_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_receipts" ADD CONSTRAINT "chat_message_receipts_last_read_message_id_chat_messages_id_fk" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_user_id_orq_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."orq_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_push_tokens" ADD CONSTRAINT "chat_push_tokens_user_id_orq_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."orq_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orqspaces" ADD CONSTRAINT "orqspaces_owner_id_orq_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."orq_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_chat_conv_client_orqspace" ON "chat_conversations" USING btree ("client_user_id","orqspace_id");--> statement-breakpoint
CREATE INDEX "idx_chat_conv_orqspace_updated" ON "chat_conversations" USING btree ("orqspace_id","last_message_at");--> statement-breakpoint
CREATE INDEX "idx_chat_conv_client_updated" ON "chat_conversations" USING btree ("client_user_id","last_message_at");--> statement-breakpoint
CREATE INDEX "idx_chat_att_message" ON "chat_message_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_chat_att_purge" ON "chat_message_attachments" USING btree ("is_expired","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_chat_receipt_conv_user" ON "chat_message_receipts" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_chat_msg_idempotency" ON "chat_messages" USING btree ("conversation_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_chat_msg_conv_created" ON "chat_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_chat_push_user" ON "chat_push_tokens" USING btree ("user_id");
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paste_code" varchar(12) NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"compression" text DEFAULT 'deflate' NOT NULL,
	"blob_path" text NOT NULL,
	"iv" "bytea" NOT NULL,
	"auth_tag" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_paste_code_pastes_code_fk" FOREIGN KEY ("paste_code") REFERENCES "public"."pastes"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_paste_code_idx" ON "attachments" USING btree ("paste_code");
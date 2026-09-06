CREATE TABLE "pastes" (
	"code" varchar(12) PRIMARY KEY NOT NULL,
	"ciphertext" "bytea" NOT NULL,
	"iv" "bytea" NOT NULL,
	"auth_tag" "bytea" NOT NULL,
	"key_wrapped" "bytea" NOT NULL,
	"salt" "bytea",
	"kdf_iterations" integer,
	"burn_after_read" boolean DEFAULT false NOT NULL,
	"consumed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"views" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pastes_expires_at_idx" ON "pastes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "pastes_created_at_idx" ON "pastes" USING btree ("created_at");
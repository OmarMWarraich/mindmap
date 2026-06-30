CREATE TABLE "completion_event" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"correlationId" text NOT NULL,
	"outcome" text NOT NULL,
	"source" text NOT NULL,
	"requestReason" text NOT NULL,
	"outlineLength" integer NOT NULL,
	"suggestionLength" integer NOT NULL,
	"shownDurationMs" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "completion_event" ADD CONSTRAINT "completion_event_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "completion_event_userId_createdAt_idx" ON "completion_event" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "completion_event_outcome_idx" ON "completion_event" USING btree ("outcome");
CREATE TABLE "stripeWebhookEvents" (
	"eventId" varchar(255) PRIMARY KEY NOT NULL,
	"type" varchar(100) NOT NULL,
	"receivedAt" timestamp DEFAULT now() NOT NULL
);

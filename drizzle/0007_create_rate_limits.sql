CREATE TABLE "rate_limits" (
	"key" varchar(128) NOT NULL,
	"hits" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "pk_rate_limits" PRIMARY KEY("key")
);

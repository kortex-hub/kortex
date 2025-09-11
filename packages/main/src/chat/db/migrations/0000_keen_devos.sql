CREATE TABLE IF NOT EXISTS "Chat" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "createdAt" integer NOT NULL,
    "title" TEXT NOT NULL,
    "lastContext" TEXT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"chatId" uuid NOT NULL,
	"role" varchar NOT NULL,
	"parts" json NOT NULL,
	"createdAt" integer NOT NULL,
    FOREIGN KEY("chatId") REFERENCES "Chat"("id")
);

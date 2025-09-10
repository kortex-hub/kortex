CREATE TABLE IF NOT EXISTS "Chat" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "createdAt" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "lastContext" TEXT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"chatId" uuid NOT NULL,
	"role" varchar NOT NULL,
	"parts" json NOT NULL,
	"attachments" json NOT NULL,
	"createdAt" timestamp NOT NULL,
    FOREIGN KEY("chatId") REFERENCES "Chat"("id")
);

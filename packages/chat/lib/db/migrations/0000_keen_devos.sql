
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "email" VARCHAR(64) NOT NULL,
    "password" VARCHAR(64)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Chat" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "createdAt" TIMESTAMP NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "visibility" VARCHAR DEFAULT 'private' NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Document" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "userId" TEXT NOT NULL,
    "text" VARCHAR DEFAULT 'text' NOT NULL,
    PRIMARY KEY ("id", "createdAt"),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Suggestion" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentCreatedAt" TIMESTAMP NOT NULL,
    "originalText" TEXT NOT NULL,
    "suggestedText" TEXT NOT NULL,
    "description" TEXT,
    "isResolved" BOOLEAN DEFAULT 0 NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    FOREIGN KEY ("documentId", "documentCreatedAt") REFERENCES "Document"("id", "createdAt") ON DELETE NO ACTION ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" VARCHAR NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Vote" (
    "chatId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "isUpvoted" BOOLEAN NOT NULL,
    PRIMARY KEY ("chatId", "messageId"),
    FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Message_v2" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" VARCHAR NOT NULL,
    "parts" TEXT NOT NULL,
    "attachments" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Vote_v2" (
    "chatId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "isUpvoted" BOOLEAN NOT NULL,
    PRIMARY KEY ("chatId", "messageId"),
    FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    FOREIGN KEY ("messageId") REFERENCES "Message_v2"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Stream" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "chatId" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

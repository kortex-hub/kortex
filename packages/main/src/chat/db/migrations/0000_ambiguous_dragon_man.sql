CREATE TABLE "Chat" (
    "id" uuid PRIMARY KEY NOT NULL,
    "createdAt" timestamp NOT NULL,
    "title" text NOT NULL,
    "userId" uuid NOT NULL,
    "visibility" varchar DEFAULT 'private' NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "Document" (
    "id" uuid NOT NULL,
    "createdAt" timestamp NOT NULL,
    "title" text NOT NULL,
    "content" text,
    "text" varchar DEFAULT 'text' NOT NULL,
    "userId" uuid NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "Message" (
    "id" uuid PRIMARY KEY NOT NULL,
    "chatId" uuid NOT NULL,
    "role" varchar NOT NULL,
    "parts" json NOT NULL,
    "attachments" json NOT NULL,
    "createdAt" timestamp NOT NULL,
    "config" json NOT NULL,
    "tokens" integer,
    FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "Session" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" uuid NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "Suggestion" (
    "id" uuid NOT NULL,
    "documentId" uuid NOT NULL,
    "documentCreatedAt" timestamp NOT NULL,
    "originalText" text NOT NULL,
    "suggestedText" text NOT NULL,
    "description" text,
    "isResolved" boolean DEFAULT false NOT NULL,
    "userId" uuid NOT NULL,
    "createdAt" timestamp NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE TABLE "User" (
    "id" uuid PRIMARY KEY NOT NULL,
    "email" varchar(64) NOT NULL,
    "password" varchar(64) NOT NULL,
    CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "Vote" (
    "chatId" uuid NOT NULL,
    "messageId" uuid NOT NULL,
    "isUpvoted" boolean NOT NULL,
    FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

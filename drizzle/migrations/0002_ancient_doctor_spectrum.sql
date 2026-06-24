PRAGMA foreign_keys=OFF;--> statement-breakpoint
UPDATE "inquiries" SET "source" = 'contact' WHERE "source" IN ('auction_request', 'vehicle_shipping');--> statement-breakpoint
CREATE TABLE `__new_inquiries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`listing_id` integer,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`contact_number` text NOT NULL,
	`company` text,
	`message` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "inquiries_source_ck" CHECK("__new_inquiries"."source" in ('home', 'product_detail', 'contact')),
	CONSTRAINT "inquiries_status_ck" CHECK("__new_inquiries"."status" in ('new', 'read', 'contacted', 'negotiating', 'won', 'lost', 'archived'))
);
--> statement-breakpoint
INSERT INTO `__new_inquiries`("id", "source", "listing_id", "name", "email", "contact_number", "company", "message", "status", "user_agent", "created_at") SELECT "id", "source", "listing_id", "name", "email", "contact_number", "company", "message", "status", "user_agent", "created_at" FROM `inquiries`;--> statement-breakpoint
DROP TABLE `inquiries`;--> statement-breakpoint
ALTER TABLE `__new_inquiries` RENAME TO `inquiries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `inquiries_source_status_created_idx` ON `inquiries` (`source`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `inquiries_created_at_idx` ON `inquiries` (`created_at`);
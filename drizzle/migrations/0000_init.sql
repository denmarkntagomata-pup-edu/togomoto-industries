CREATE TABLE `announcements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`excerpt` text,
	`body` text NOT NULL,
	`cover_image_r2_key` text,
	`author` text,
	`is_published` integer DEFAULT false NOT NULL,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `announcements_slug_unique` ON `announcements` (`slug`);--> statement-breakpoint
CREATE INDEX `announcements_published_idx` ON `announcements` (`is_published`,`published_at`);--> statement-breakpoint
CREATE TABLE `inquiries` (
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
	CONSTRAINT "inquiries_source_ck" CHECK("inquiries"."source" in ('home', 'product_detail', 'auction_request', 'vehicle_shipping', 'contact')),
	CONSTRAINT "inquiries_status_ck" CHECK("inquiries"."status" in ('new', 'read', 'responded', 'archived'))
);
--> statement-breakpoint
CREATE INDEX `inquiries_source_status_created_idx` ON `inquiries` (`source`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `inquiries_created_at_idx` ON `inquiries` (`created_at`);--> statement-breakpoint
CREATE TABLE `listing_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`r2_key` text NOT NULL,
	`alt` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `listing_images_listing_sort_idx` ON `listing_images` (`listing_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`reference_number` text,
	`maker` text,
	`model` text,
	`body` text,
	`year_of_manufacture` integer,
	`mileage` integer,
	`color` text,
	`location` text,
	`condition` text,
	`transmission_type` text,
	`fuel_type` text,
	`status` text DEFAULT 'available' NOT NULL,
	`price` real,
	`price_on_application` integer DEFAULT false NOT NULL,
	`description` text,
	`specs` text,
	`is_featured` integer DEFAULT false NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "listings_category_ck" CHECK("listings"."category" in ('used_car', 'used_truck', 'used_heavy_equipment')),
	CONSTRAINT "listings_status_ck" CHECK("listings"."status" in ('available', 'reserved', 'sold', 'incoming')),
	CONSTRAINT "listings_condition_ck" CHECK("listings"."condition" in ('used', 'reconditioned', 'for_parts')),
	CONSTRAINT "listings_transmission_ck" CHECK("listings"."transmission_type" in ('manual', 'automatic', 'semi_automatic', 'other')),
	CONSTRAINT "listings_fuel_ck" CHECK("listings"."fuel_type" in ('diesel', 'gasoline', 'hybrid', 'electric', 'other'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listings_slug_unique` ON `listings` (`slug`);--> statement-breakpoint
CREATE INDEX `listings_category_status_idx` ON `listings` (`category`,`status`);--> statement-breakpoint
CREATE INDEX `listings_is_published_idx` ON `listings` (`is_published`);--> statement-breakpoint
CREATE TABLE `spare_parts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`description` text,
	`price` real,
	`image_r2_key` text,
	`is_published` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `spare_parts_published_sort_idx` ON `spare_parts` (`is_published`,`sort_order`);
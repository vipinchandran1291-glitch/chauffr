CREATE TABLE `booking_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`type` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`actor_id` integer,
	`data` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `booking_events_booking_idx` ON `booking_events` (`booking_id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`car_id` integer NOT NULL,
	`driver_id` integer,
	`status` text DEFAULT 'requested' NOT NULL,
	`kind` text NOT NULL,
	`pickup_address` text NOT NULL,
	`pickup_lat` real,
	`pickup_lng` real,
	`scheduled_at` integer,
	`expected_minutes` integer NOT NULL,
	`start_otp` text NOT NULL,
	`rate_card` text NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`fare` integer,
	`commission` integer,
	`driver_earning` integer,
	`cancelled_by` integer,
	`cancel_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bookings_status_idx` ON `bookings` (`status`);--> statement-breakpoint
CREATE INDEX `bookings_customer_idx` ON `bookings` (`customer_id`);--> statement-breakpoint
CREATE INDEX `bookings_driver_idx` ON `bookings` (`driver_id`);--> statement-breakpoint
CREATE TABLE `cars` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`reg_number` text NOT NULL,
	`transmission` text NOT NULL,
	`car_type` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cars_owner_idx` ON `cars` (`owner_id`);--> statement-breakpoint
CREATE TABLE `driver_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`driver_id` integer NOT NULL,
	`kind` text NOT NULL,
	`file_path` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `driver_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`driver_id` integer NOT NULL,
	`booking_id` integer,
	`payout_id` integer,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`driver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payout_id`) REFERENCES `payouts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `driver_ledger_driver_idx` ON `driver_ledger` (`driver_id`);--> statement-breakpoint
CREATE TABLE `drivers` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'incomplete' NOT NULL,
	`licence_number` text,
	`licence_expiry` text,
	`can_manual` integer DEFAULT false NOT NULL,
	`can_automatic` integer DEFAULT false NOT NULL,
	`car_types` text NOT NULL,
	`is_online` integer DEFAULT false NOT NULL,
	`last_lat` real,
	`last_lng` real,
	`last_location_at` integer,
	`reviewed_at` integer,
	`reviewed_by` integer,
	`rejection_reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `drivers_status_idx` ON `drivers` (`status`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`method` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`razorpay_order_id` text,
	`razorpay_payment_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_razorpay_order_id_unique` ON `payments` (`razorpay_order_id`);--> statement-breakpoint
CREATE INDEX `payments_booking_idx` ON `payments` (`booking_id`);--> statement-breakpoint
CREATE TABLE `payouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`driver_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`reference` text,
	`paid_at` integer NOT NULL,
	`created_by` integer NOT NULL,
	FOREIGN KEY (`driver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rate_cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`base_fare` integer NOT NULL,
	`base_minutes` integer NOT NULL,
	`extra_per_30_min` integer NOT NULL,
	`night_charge` integer NOT NULL,
	`night_start_hour` integer NOT NULL,
	`night_end_hour` integer NOT NULL,
	`commission_bps` integer NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`google_sub` text,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`avatar_url` text,
	`phone` text,
	`phone_verified` integer DEFAULT false NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_sub_unique` ON `users` (`google_sub`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
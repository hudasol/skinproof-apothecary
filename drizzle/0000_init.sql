CREATE TABLE `analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`consultation_id` text NOT NULL,
	`provider_mode` text NOT NULL,
	`provider_label` text NOT NULL,
	`status` text NOT NULL,
	`input_artifact_id` text,
	`requested_concerns` text NOT NULL,
	`units_estimated` integer NOT NULL,
	`task_id` text,
	`result` text,
	`failure` text,
	`diagnostics` text NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`consultation_id`) REFERENCES `consultations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`input_artifact_id`) REFERENCES `artifacts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `analyses_consultation_idx` ON `analyses` (`consultation_id`);--> statement-breakpoint
CREATE INDEX `analyses_created_idx` ON `analyses` (`created_at`);--> statement-breakpoint
CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`consultation_id` text,
	`kind` text NOT NULL,
	`provenance` text NOT NULL,
	`sha256` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`bytes` integer NOT NULL,
	`width` integer,
	`height` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`consultation_id`) REFERENCES `consultations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `artifacts_sha_idx` ON `artifacts` (`sha256`);--> statement-breakpoint
CREATE INDEX `artifacts_consultation_idx` ON `artifacts` (`consultation_id`);--> statement-breakpoint
CREATE TABLE `consultations` (
	`id` text PRIMARY KEY NOT NULL,
	`analysis_consent_at` integer,
	`preview_consent_at` integer,
	`profile` text,
	`images_expire_at` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `consultations_expires_idx` ON `consultations` (`expires_at`);--> statement-breakpoint
CREATE TABLE `decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`consultation_id` text NOT NULL,
	`analysis_id` text,
	`rule_version` text NOT NULL,
	`catalogue_version` text NOT NULL,
	`inputs_hash` text NOT NULL,
	`decision` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`consultation_id`) REFERENCES `consultations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`analysis_id`) REFERENCES `analyses`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `decisions_consultation_idx` ON `decisions` (`consultation_id`);--> statement-breakpoint
CREATE TABLE `previews` (
	`id` text PRIMARY KEY NOT NULL,
	`consultation_id` text NOT NULL,
	`product_id` text NOT NULL,
	`shade_id` text NOT NULL,
	`provider_mode` text NOT NULL,
	`provider_label` text NOT NULL,
	`status` text NOT NULL,
	`units_estimated` integer NOT NULL,
	`input_artifact_id` text,
	`output_artifact_id` text,
	`effects` text NOT NULL,
	`task_id` text,
	`failure` text,
	`diagnostics` text NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`consultation_id`) REFERENCES `consultations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`input_artifact_id`) REFERENCES `artifacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`output_artifact_id`) REFERENCES `artifacts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `previews_consultation_idx` ON `previews` (`consultation_id`);--> statement-breakpoint
CREATE INDEX `previews_created_idx` ON `previews` (`created_at`);
DELETE FROM `pop_off_payments`;
--> statement-breakpoint
DELETE FROM `pop_off_applications`;
--> statement-breakpoint
DELETE FROM `notifications`;
--> statement-breakpoint
DROP TABLE `pop_off_payments`;
--> statement-breakpoint
DROP TABLE `pop_off_applications`;
--> statement-breakpoint
DROP TABLE `notifications`;
--> statement-breakpoint
UPDATE `my_profile` SET `pop_off_on` = 0, `pop_off_budget_cents` = NULL, `pop_off_category` = '', `pop_off_spot` = '', `pop_off_note` = '', `pop_off_expires_at` = NULL, `pop_off_paid_cents` = NULL, `pop_off_plan` = '';
--> statement-breakpoint
UPDATE `people` SET `pop_off_on` = 0, `pop_off_budget_cents` = NULL, `pop_off_category` = '', `pop_off_spot` = '', `pop_off_note` = '', `pop_off_expires_at` = NULL, `pop_off_paid_cents` = NULL, `pop_off_plan` = '';

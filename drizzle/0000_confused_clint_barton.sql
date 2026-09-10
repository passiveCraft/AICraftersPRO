CREATE TABLE `n8n_connections` (
	`user_id` text PRIMARY KEY NOT NULL,
	`instance_url` text NOT NULL,
	`encrypted_key` text NOT NULL,
	`connected_at` text NOT NULL
);

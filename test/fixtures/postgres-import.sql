TRUNCATE "BlockedPlayerByWatch", "BlockedPlayer", "PlayerLink", "Watch", "User" RESTART IDENTITY CASCADE;
INSERT INTO "User" ("discordUserId", "discordUsername", "createdAt", "updatedAt", "snoozedUntil")
VALUES ('100', 'Synthetic User', '2020-02-03 04:05:06.789', '2021-03-04 05:06:07.123', '2035-04-05 06:07:08.456');
INSERT INTO "Watch" (id, "discordUserId", server, "watchType", "itemName", "priceRequirement", created, active, "snoozedUntil", notes, "isPublicallyTradeable")
VALUES (7, '100', 'BLUE', 'WTB', 'SWORD', 123, '2020-02-03 04:05:06.789', false, '2035-04-05 06:07:08.456', 'Unicode café and punctuation', false);
INSERT INTO "Watch" (id, "discordUserId", server, "watchType", "itemName")
SELECT n, '100', 'GREEN', 'WTS', 'SYNTHETIC ' || n FROM generate_series(10, 520) n;
SELECT setval('"Watch_id_seq"', 1000, true);
INSERT INTO "BlockedPlayer" (id, "discordUserId", server, player, active) VALUES (9, '100', 'RED', 'BLOCKED', false);
INSERT INTO "BlockedPlayerByWatch" (id, "discordUserId", "watchId", player) VALUES (11, '100', 7, 'BLOCKED');
INSERT INTO "PlayerLink" (id, "discordUserId", server, player, "linkCode", "linkCodeExpiry")
VALUES (13, '100', NULL, NULL, '12345678-abcd-4321-abcd-123456789abc', '2035-04-05 06:07:08.456');

import { ButtonInteraction, MessageComponentInteraction } from 'discord.js';

export async function removeInteractionContentAfterDelay(
	interaction: ButtonInteraction | MessageComponentInteraction,
	delay: number = 5000,
) {
	setTimeout(async () => {
		await interaction.deleteReply();
	}, delay);
}

import { SlashCommandNumberOption, SlashCommandStringOption } from 'discord.js';

export const watchTypeOptions = (option: SlashCommandStringOption) =>
	option
		.setName('type')
		.setDescription('the type of auction to watch')
		.addChoices(
			{ name: 'WTS', value: 'WTS' },
			{ name: 'WTB', value: 'WTB' },
		)
		.setRequired(true);

export const itemNameOptions = (option: SlashCommandStringOption) =>
	option
		.setName('item')
		.setDescription('the name of the item you want to watch')
		.setRequired(true);

export const autoCompleteItemNameOptions = (option: SlashCommandStringOption) =>
	option
		.setName('item')
		.setDescription('the name of the item you want to watch')
		.setRequired(true)
		.setAutocomplete(true);

export const autoCompleteWatchOptionsForSnooze = (
	option: SlashCommandStringOption,
) =>
	option
		.setName('watch')
		.setDescription('the watch you want to snooze')
		.setAutocomplete(true)
		.setRequired(true);

export const autoCompleteWatchOptionsForUnwatch = (
	option: SlashCommandStringOption,
) =>
	option
		.setName('watch')
		.setDescription('the watch you want to end')
		.setAutocomplete(true)
		.setRequired(true);

export const autoCompleteWatchOptionsForInfoCommand = (
	option: SlashCommandStringOption,
) =>
	option
		.setName('watch')
		.setDescription('the watch you information on')
		.setAutocomplete(true)
		.setRequired(true);

export const snoozeHoursOptions = (option: SlashCommandNumberOption) =>
	option
		.setName('hours')
		.setDescription('how many hours to snooze for')
		.setMinValue(1)
		.setMaxValue(168);

export const requiredsServerOptions = (option: SlashCommandStringOption) =>
	option
		.setName('server')
		.setDescription('select a server')
		.addChoices(
			{ name: 'blue server', value: 'BLUE' },
			{ name: 'green server', value: 'GREEN' },
			{ name: 'red server', value: 'RED' },
		)
		.setRequired(true);

export const priceCriteriaOptions = (option: SlashCommandNumberOption) =>
	option.setName('price').setDescription('enter optional price criteria');

export const playerNameOptions = (option: SlashCommandStringOption) =>
	option
		.setName('player')
		.setDescription('the name of a player')
		.setRequired(true);

export const autoCompletePlayerNameOptions = (
	option: SlashCommandStringOption,
) =>
	option
		.setName('player')
		.setDescription('the name of the player you want to unblock')
		.setAutocomplete(true)
		.setRequired(true);

export const optionalServerOptions = (option: SlashCommandStringOption) =>
	option
		.setName('server')
		.setDescription('select a server')
		.addChoices(
			{ name: 'blue server', value: 'BLUE' },
			{ name: 'green server', value: 'GREEN' },
			{ name: 'red server', value: 'RED' },
		);

export const watchFilterOptions = (option: SlashCommandStringOption) =>
	option
		.setName('filter')
		.setDescription('optional string to filter watches by');

export const watchNotesOptions = (option: SlashCommandStringOption) =>
	option
		.setName('notes')
		.setDescription('notes about this watch - only visible to you');

export const blockFilterOptions = (option: SlashCommandStringOption) =>
	option
		.setName('filter')
		.setDescription('optional string to filter blocks by');

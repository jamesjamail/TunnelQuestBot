import { describe, it, expect } from 'vitest';
import { ButtonStyle } from 'discord.js';
import {
	ButtonInteractionTypes,
	buttonBuilder,
	parseCustomId,
} from './buttonBuilder';

describe('parseCustomId', () => {
	it('parses an action type without segments', () => {
		expect(parseCustomId('UnwatchActive')).toEqual({
			actionType: 'UnwatchActive',
			entityId: undefined,
			extra: undefined,
		});
	});

	it('parses entityId from a two-part customId', () => {
		expect(parseCustomId('UnwatchActive:42')).toEqual({
			actionType: 'UnwatchActive',
			entityId: '42',
			extra: undefined,
		});
	});

	it('parses entityId and extra from a three-part customId', () => {
		expect(parseCustomId('WatchBlockInactive:42:Soandso')).toEqual({
			actionType: 'WatchBlockInactive',
			entityId: '42',
			extra: 'Soandso',
		});
	});

	it('rejoins extra segments that contain colons', () => {
		expect(parseCustomId('WatchBlockInactive:42:Some:Name')).toEqual({
			actionType: 'WatchBlockInactive',
			entityId: '42',
			extra: 'Some:Name',
		});
	});

	it('treats a trailing colon as missing entityId', () => {
		expect(parseCustomId('Foo:')).toEqual({
			actionType: 'Foo',
			entityId: undefined,
			extra: undefined,
		});
	});
});

function buttonFromRow(type: ButtonInteractionTypes, entityId?: string) {
	const rows = buttonBuilder([{ type, entityId }]);
	return rows[0].components[0].toJSON();
}

describe('buttonBuilder', () => {
	it('uses Primary for Active and Secondary for Inactive by default', () => {
		expect(
			buttonFromRow(ButtonInteractionTypes.WatchRefreshActive).style,
		).toBe(ButtonStyle.Primary);
		expect(
			buttonFromRow(ButtonInteractionTypes.WatchRefreshInactive).style,
		).toBe(ButtonStyle.Secondary);
	});

	it('uses Danger for UnwatchActive and GlobalUnblockActive', () => {
		expect(buttonFromRow(ButtonInteractionTypes.UnwatchActive).style).toBe(
			ButtonStyle.Danger,
		);
		expect(
			buttonFromRow(ButtonInteractionTypes.GlobalUnblockActive).style,
		).toBe(ButtonStyle.Danger);
	});

	it('uses Success for ConfirmActionActive, UnlinkCharacterActive, and WatchBlockActive', () => {
		expect(
			buttonFromRow(ButtonInteractionTypes.ConfirmActionActive).style,
		).toBe(ButtonStyle.Success);
		expect(
			buttonFromRow(ButtonInteractionTypes.UnlinkCharacterActive).style,
		).toBe(ButtonStyle.Success);
		expect(
			buttonFromRow(ButtonInteractionTypes.WatchBlockActive).style,
		).toBe(ButtonStyle.Success);
	});

	it('uses Danger for CancelActionActive', () => {
		expect(
			buttonFromRow(ButtonInteractionTypes.CancelActionActive).style,
		).toBe(ButtonStyle.Danger);
	});

	it('sets snooze labels to the sleep emoji', () => {
		expect(
			buttonFromRow(ButtonInteractionTypes.WatchSnoozeActive).label,
		).toBe('💤');
		expect(
			buttonFromRow(ButtonInteractionTypes.UserSnoozeActive).label,
		).toBe('💤');
		expect(
			buttonFromRow(ButtonInteractionTypes.WatchNotificationSnoozeActive)
				.label,
		).toBe('💤');
	});

	it('sets unwatch and unblock labels to the cross emoji', () => {
		expect(buttonFromRow(ButtonInteractionTypes.UnwatchActive).label).toBe(
			'❌',
		);
		expect(
			buttonFromRow(ButtonInteractionTypes.GlobalUnblockActive).label,
		).toBe('❌');
		expect(
			buttonFromRow(ButtonInteractionTypes.WatchNotificationUnwatchActive)
				.label,
		).toBe('❌');
	});

	it('sets refresh labels to the recycle emoji', () => {
		expect(
			buttonFromRow(ButtonInteractionTypes.WatchRefreshActive).label,
		).toBe('♻️');
		expect(
			buttonFromRow(ButtonInteractionTypes.GlobalRefreshActive).label,
		).toBe('♻️');
		expect(
			buttonFromRow(
				ButtonInteractionTypes.WatchNotificationWatchRefreshActive,
			).label,
		).toBe('♻️');
	});

	it('sets WatchBlock labels to the mute emoji', () => {
		expect(
			buttonFromRow(ButtonInteractionTypes.WatchBlockActive).label,
		).toBe('🔕');
	});

	it('sets Confirm and Cancel labels', () => {
		expect(
			buttonFromRow(ButtonInteractionTypes.ConfirmActionActive).label,
		).toBe('Confirm');
		expect(
			buttonFromRow(ButtonInteractionTypes.CancelActionActive).label,
		).toBe('Cancel');
	});

	it('uses Relink when active and Unlink when inactive for UnlinkCharacter', () => {
		expect(
			buttonFromRow(ButtonInteractionTypes.UnlinkCharacterActive).label,
		).toBe('Relink');
		expect(
			buttonFromRow(ButtonInteractionTypes.UnlinkCharacterInactive).label,
		).toBe('Unlink');
	});

	it('appends entityId to customId when supplied', () => {
		expect(
			buttonFromRow(ButtonInteractionTypes.UnwatchActive, '42').custom_id,
		).toBe('UnwatchActive:42');
	});

	it('omits entityId from customId when not supplied', () => {
		expect(
			buttonFromRow(ButtonInteractionTypes.UnwatchActive).custom_id,
		).toBe('UnwatchActive');
	});

	it('builds every ButtonInteractionTypes member without throwing', () => {
		for (const type of Object.values(ButtonInteractionTypes).filter(
			(v) => typeof v === 'number',
		) as ButtonInteractionTypes[]) {
			expect(() => buttonBuilder([{ type }])).not.toThrow();
		}
	});
});

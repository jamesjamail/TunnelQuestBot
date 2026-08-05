import { describe, it, expect } from 'vitest';
import { messageCopy } from './messageCopy';
import { makePlayerLink } from '../../../test/factories';

describe('messageCopy delivery notifications', () => {
	describe('watchesHaveBeenDeliveredViaDm', () => {
		it('returns a no-watches message without channel id for zero', () => {
			const result = messageCopy.watchesHaveBeenDeliveredViaDm(
				0,
				'chan-1',
			);
			expect(result).toBe('No watches found.');
			expect(result).not.toContain('chan-1');
		});

		it('singularizes for one watch', () => {
			expect(messageCopy.watchesHaveBeenDeliveredViaDm(1, 'chan-1')).toBe(
				'1 watch has been delivered via DM <#chan-1>',
			);
		});

		it('pluralizes for multiple watches', () => {
			expect(messageCopy.watchesHaveBeenDeliveredViaDm(5, 'chan-1')).toBe(
				'5 watches have been delivered via DM <#chan-1>',
			);
		});
	});

	describe('linksHaveBeenDeliveredViaDm', () => {
		it('returns a no-links message without channel id for zero', () => {
			const result = messageCopy.linksHaveBeenDeliveredViaDm(0, 'chan-1');
			expect(result).toBe('No character links found.');
			expect(result).not.toContain('chan-1');
		});

		it('singularizes for one link', () => {
			expect(messageCopy.linksHaveBeenDeliveredViaDm(1, 'chan-1')).toBe(
				'1 character link has been delivered via DM <#chan-1>',
			);
		});

		it('pluralizes for multiple links', () => {
			expect(messageCopy.linksHaveBeenDeliveredViaDm(5, 'chan-1')).toBe(
				'5 character links have been delivered via DM <#chan-1>',
			);
		});
	});

	describe('blocksHaveBeenDeliveredViaDm', () => {
		it('returns a no-blocks message without channel id for zero', () => {
			const result = messageCopy.blocksHaveBeenDeliveredViaDm(
				0,
				'chan-1',
			);
			expect(result).toBe('No blocks found.');
			expect(result).not.toContain('chan-1');
		});

		it('singularizes for one block', () => {
			expect(messageCopy.blocksHaveBeenDeliveredViaDm(1, 'chan-1')).toBe(
				'1 block has been delivered via DM <#chan-1>',
			);
		});

		it('pluralizes for multiple blocks', () => {
			expect(messageCopy.blocksHaveBeenDeliveredViaDm(5, 'chan-1')).toBe(
				'5 blocks have been delivered via DM <#chan-1>',
			);
		});
	});
});

describe('messageCopy snooze and block messages', () => {
	it('uses default snooze hours when none are passed', () => {
		expect(messageCopy.yourWatchHasBeenSnoozed()).toBe(
			'Your watch has been snoozed for 6 hours.',
		);
	});

	it('includes custom snooze hours when provided', () => {
		expect(messageCopy.yourWatchHasBeenSnoozed(12)).toBe(
			'Your watch has been snoozed for 12 hours.',
		);
	});

	it('defaults all-watches snooze to 6 hours', () => {
		expect(messageCopy.allYourWatchesHaveBeenSnoozed()).toBe(
			'All your watches have been snoozed for 6 hours.  Use the 💤 button below to unsnooze.',
		);
	});

	it('returns generic message when no block filter is provided', () => {
		expect(messageCopy.youDontHaveAnyBlocks('')).toBe(
			"You don't have any blocks.  Add some with ``/block``",
		);
	});

	it('mentions the filter when one is provided', () => {
		const result = messageCopy.youDontHaveAnyBlocks('soandso');
		expect(result).toBe(
			"You don't have any blocks that contain **soandso**.",
		);
		expect(result).not.toBe(messageCopy.youDontHaveAnyBlocks(''));
	});
});

describe('messageCopy watch and link messages', () => {
	it('title-cases watch names in watch info header', () => {
		expect(
			messageCopy.heresInformationOnYourWatch('FLOWING BLACK SILK SASH'),
		).toBe("Here's information on your ``Flowing Black Silk Sash`` watch:");
	});

	it('returns different unlink success and failure messages', () => {
		const link = makePlayerLink();
		const success = messageCopy.soAndSoHasBeenUnlinked(link);
		const failure = messageCopy.soAndSoHasFailedToBeUnlinked(link);

		expect(success).toBe(
			'`Soandso` on `BLUE` has been unlinked from your discord user.',
		);
		expect(failure).toBe(
			'No such character link (`Soandso` on `BLUE`) exists for your discord user.',
		);
		expect(success).not.toBe(failure);
	});
});

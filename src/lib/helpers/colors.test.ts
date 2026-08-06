import { describe, it, expect } from 'vitest';
import { Server } from '../../prisma/client';
import { getServerColorFromString } from './colors';

describe('getServerColorFromString', () => {
	it('returns blue server color', () => {
		expect(getServerColorFromString(Server.BLUE)).toBe('#1C58B8');
	});

	it('returns green server color', () => {
		expect(getServerColorFromString(Server.GREEN)).toBe('#249458');
	});

	it('returns red server color', () => {
		expect(getServerColorFromString(Server.RED)).toBe('#B82323');
	});

	it('throws for unmapped server values', () => {
		expect(() => getServerColorFromString('PURPLE' as Server)).toThrow(
			'No color defined for server: PURPLE',
		);
	});
});

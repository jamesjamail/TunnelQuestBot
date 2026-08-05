export function toTitleCase(input: string): string {
	const prepositions = [
		'of',
		'in',
		'to',
		'for',
		'with',
		'on',
		'at',
		'from',
		'by',
		'about',
		'as',
		'the',
		'a',
		'an',
	];

	return input
		.split(/([\s-])/)
		.map((token, index) => {
			if (token === '-' || /^\s$/.test(token)) return token;
			const lowerCaseWord = token.toLowerCase();
			if (index === 0 || !prepositions.includes(lowerCaseWord)) {
				return token.charAt(0).toUpperCase() + lowerCaseWord.slice(1);
			}
			return lowerCaseWord;
		})
		.join('')
		.trim();
}

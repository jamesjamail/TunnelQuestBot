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
		.split(/[\s-]/) // Split by space and hyphen
		.map((word, index) => {
			const lowerCaseWord = word.toLowerCase();
			// Always capitalize the first word or if it's not a preposition
			if (index === 0 || !prepositions.includes(lowerCaseWord)) {
				return word.charAt(0).toUpperCase() + lowerCaseWord.slice(1);
			} else {
				return lowerCaseWord;
			}
		})
		.join(' ') // First join with spaces
		.replace(/ ([^- ]*)-/g, ' $1-') // Then restore hyphens
		.trim(); // Remove any leading or trailing spaces
}

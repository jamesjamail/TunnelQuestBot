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
			// Always capitalize the first word or if it's not a preposition
			if (index === 0 || !prepositions.includes(word.toLowerCase())) {
				return (
					word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
				);
			} else {
				return word.toLowerCase();
			}
		})
		.join(' ') // First join with spaces
		.replace(/ ([^- ]*)-/g, ' $1-') // Then restore hyphens
		.trim(); // Remove any leading or trailing spaces
}

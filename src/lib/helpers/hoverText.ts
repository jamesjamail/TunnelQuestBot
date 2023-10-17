export function formatHoverText(
	displayText: string,
	wikiUrl?: string,
	hoverText?: string,
): string {
	if (wikiUrl && hoverText) {
		return `[${displayText}](${wikiUrl} "${hoverText}")`;
	}
	return displayText;
}

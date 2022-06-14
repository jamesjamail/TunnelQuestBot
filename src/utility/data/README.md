# Wiki Indexing Script

[Aho-Corasick](https://en.wikipedia.org/wiki/Aho%E2%80%93Corasick_algorithm)
searching requires a database of all item names.
This will scrape the P99 Wiki for a full database of item and spell names, and
export that list along with relative wiki URLs to two JSON files.

## Usage

Just run the script `generateIndexes.js` with the same version of Node that is
installed for the main app.

## Notes

Do not edit `items.json` or `spells.json` by hand. Additional files like
`aliases.json` can be edited manually, but any changes to the first two will
be lost whenever they are regenerated.

Regenerating these files should not be required often, as new items are not
added to the wiki with any frequency these days. However, if it seems like
any common things are missing and were recently added, then go ahead and do it.

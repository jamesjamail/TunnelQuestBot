import inGameItemsObject from '../gameData/items.json';

class TrieNode {
	children: { [key: string]: TrieNode };
	isEndOfWord: boolean;

	constructor() {
		this.children = {};
		this.isEndOfWord = false;
	}
}

export class Trie {
	root: TrieNode;

	constructor() {
		this.root = new TrieNode();
	}

	insert(itemName: string): void {
		let node = this.root;
		// Split the itemName into words
		const words = itemName.split(' ');
		for (const word of words) {
			if (!node.children[word]) {
				node.children[word] = new TrieNode();
			}
			node = node.children[word];
		}
		node.isEndOfWord = true;
	}

	search(itemName: string): boolean {
		let node = this.root;
		// Split the itemName into words
		const words = itemName.split(' ');
		for (const word of words) {
			if (!node.children[word]) return false;
			node = node.children[word];
		}
		return node.isEndOfWord;
	}

	findMatchStartingWithFirstWord(
		words: string[],
	): { match: string; endIndex: number } | null {
		let node = this.root;
		let currentMatch = '';
		let longestMatch = '';
		let longestEndIndex = -1;

		for (let i = 0; i < words.length; i++) {
			const word = words[i];

			if (!node.children[word]) {
				break; // Stop searching if a word is not found in the trie
			}

			node = node.children[word];
			currentMatch += (currentMatch ? ' ' : '') + word;

			if (node.isEndOfWord) {
				longestMatch = currentMatch;
				longestEndIndex = i;
			}
		}

		return longestMatch
			? { match: longestMatch, endIndex: longestEndIndex }
			: null;
	}
}

export const itemTrie = new Trie();
// populate the Trie with all in-game item names
for (const itemName of Object.keys(inGameItemsObject)) {
	itemTrie.insert(itemName);
}

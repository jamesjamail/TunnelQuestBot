import inGameItemsObject from '../content/gameData/items.json';

class TrieNode {
	children: { [key: string]: TrieNode };
	isEndOfWord: boolean;

	constructor() {
		this.children = {};
		this.isEndOfWord = false;
	}
}

class Trie {
	root: TrieNode;

	constructor() {
		this.root = new TrieNode();
	}

	insert(word: string): void {
		let node = this.root;
		for (const char of word) {
			if (!node.children[char]) {
				node.children[char] = new TrieNode();
			}
			node = node.children[char];
		}
		node.isEndOfWord = true;
	}

	search(word: string): boolean {
		let node = this.root;
		for (const char of word) {
			if (!node.children[char]) return false;
			node = node.children[char];
		}
		return node.isEndOfWord;
	}
}

export const itemTrie = new Trie();
// populate the Trie with all in-game item names
for (const itemName of Object.keys(inGameItemsObject)) {
	itemTrie.insert(itemName);
}

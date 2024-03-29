import { Server } from '@prisma/client';
import * as fs from 'fs';
import { config } from 'dotenv';
import path from 'path';
import { consolidatedItems } from '../gameData/consolidatedItems';

config();

const players = ['Adam', 'Bob', 'Carl'];
const actions = ['WTB', 'WTS'];
const items = Object.keys(consolidatedItems).map((item) => item.toLowerCase());
const delimiters = [',', '/', '\\', '-', '|', ' '];

function getRandomElement(arr: string[]) {
	return arr[Math.floor(Math.random() * arr.length)];
}

function generatePrice(): string {
	const isK = Math.random() < 0.5;
	const amount = isK
		? parseFloat((Math.random() * 10).toFixed(1)) // for k up to 10k with 1 decimal
		: Math.floor(Math.random() * 1000); // for pp
	const currency = isK ? 'k' : 'pp';
	return ' ' + amount + currency;
}

function generateLogLine() {
	const playerName = getRandomElement(players);
	const action = getRandomElement(actions);
	const itemCount = Math.floor(Math.random() * 5) + 1;
	const selectedItems: string[] = [];

	for (let i = 0; i < itemCount; i++) {
		let randomItem;
		do {
			randomItem = getRandomElement(items);
		} while (selectedItems.includes(randomItem));

		if (Math.random() < 0.5) {
			const price = generatePrice();
			randomItem += price;
		}

		selectedItems.push(randomItem);
	}
	const delimiter = getRandomElement(delimiters);
	const itemText = selectedItems.join(' ' + delimiter + delimiter + ' ');
	const rawTimestamp = new Date();
	const options: Intl.DateTimeFormatOptions = {
		weekday: 'short',
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	};
	const timestamp = rawTimestamp.toLocaleDateString('en-US', options);
	return `[${timestamp}] ${playerName} auctions, '${action} ${itemText}'\n`;
}

function generateLogs(numLines: number) {
	let logs = '';
	for (let i = 0; i < numLines; i++) {
		logs += generateLogLine();
	}
	return logs;
}

export function getLogFilePath(server: Server): string {
	const baseFakeLogDirectory = path.join(__dirname, '..', 'fakeLogs');
	if (!fs.existsSync(baseFakeLogDirectory)) {
		fs.mkdirSync(baseFakeLogDirectory);
	}
	const logFilePath = path.join(baseFakeLogDirectory, `${server}.log`);
	if (!logFilePath) {
		throw new Error(`Log file path for server ${server} is not defined.`);
	}
	return logFilePath;
}

function appendFakeLogs() {
	const servers: Server[] = ['BLUE', 'GREEN', 'RED'];
	servers.forEach((server) => {
		const logPath = getLogFilePath(server);
		const logs = generateLogs(1);
		fs.appendFileSync(logPath, logs, 'utf-8');
	});
}

appendFakeLogs();
setInterval(appendFakeLogs, 1000);

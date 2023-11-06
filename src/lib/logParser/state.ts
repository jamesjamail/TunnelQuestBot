import { EventEmitter } from 'events';
import {
	GroupedWatchesType,
	initializeGroupedWatches,
} from '@src/prisma/dbExecutors';

export const state: { watchedItems: GroupedWatchesType } = {
	watchedItems: initializeGroupedWatches(),
};

export const events = new EventEmitter();

import { EventEmitter } from 'events';
import {
	GroupedWatchesType,
	initializeGroupedWatches,
} from '../../prisma/dbExecutors/watch';

export const state: { watchedItems: GroupedWatchesType } = {
	watchedItems: initializeGroupedWatches(),
};

export const events = new EventEmitter();

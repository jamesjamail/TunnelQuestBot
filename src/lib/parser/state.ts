import {
	GroupedWatchesType,
	initializeGroupedWatches,
} from '../../prisma/dbExecutors/watch';

export const state: { watchedItems: GroupedWatchesType } = {
	watchedItems: initializeGroupedWatches(),
};

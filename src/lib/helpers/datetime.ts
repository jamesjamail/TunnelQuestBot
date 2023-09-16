import {
	differenceInDays,
	differenceInHours,
	differenceInMinutes,
} from 'date-fns';

function getHumanReadableTimeFromNow(endDate: Date): string {
	const totalDays = differenceInDays(endDate, new Date());
	const totalHours = differenceInHours(endDate, new Date()) % 24;
	const totalMinutes = differenceInMinutes(endDate, new Date()) % 60;
	return `Expires in ${totalDays} days, ${totalHours} hours, and ${totalMinutes} minutes`;
}

function getHumanReadableTimeUntil(endDate: Date): string {
	const totalHours = differenceInHours(endDate, new Date()) % 24;
	const totalMinutes = differenceInMinutes(endDate, new Date()) % 60;
	return `Snoozed for another ${totalHours} hours and ${totalMinutes} minutes`;
}

export function formatWatchExpirationTimestamp(createdTimestamp: Date) {
	// watch duration can be configured optionally in envs, but defaulted to 7 days
	const watchDuration = Number(process.env.WATCH_DURATION_IN_DAYS) || 7;
	const expirationTimestamp = new Date(
		createdTimestamp.getTime() + watchDuration * 24 * 60 * 60 * 1000,
	); // 1 week
	return getHumanReadableTimeFromNow(expirationTimestamp);
}

export function formatSnoozeExpirationTimestamp(endTimestamp: Date) {
	return getHumanReadableTimeUntil(endTimestamp);
}

// TODO: accept snooze default as optional ENV
export function getExpirationTimestampForSnooze(hours: number = 6): Date {
	let otherHours = hours;
	if (!hours) {
		otherHours = 6;
	}
	const currentDate = new Date();
	currentDate.setHours(currentDate.getHours() + otherHours);
	return currentDate;
}

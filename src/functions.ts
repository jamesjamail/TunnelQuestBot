import chalk from 'chalk';

type colorType = 'text' | 'variable' | 'error';

const themeColors = {
	text: '#ff8e4d',
	variable: '#ff624d',
	error: '#f5426c',
};

export const color = (color: colorType, message: string) => {
	return chalk.hex(themeColors[color])(message);
};

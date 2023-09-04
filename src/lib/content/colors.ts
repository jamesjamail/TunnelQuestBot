import { Server } from '@prisma/client';
import { ColorResolvable } from 'discord.js';

// TODO: make these colors option envs

// this will throw a compile error if the schema is modified - this is intentional
const serverColors: { [key in keyof typeof Server]?: string } = {
    BLUE: "#1C58B8",
    GREEN: "#249458",
    RED: "#B82323" 
};

export function getServerColorFromString(server: Server) {
    const color = serverColors[server];
    if (!color) {
        throw new Error(`No color defined for server: ${server}`);
    }
    return color as ColorResolvable;    //  appeasing typescript here
}

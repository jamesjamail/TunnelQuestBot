import { Prisma, PrismaClient, Server, SnoozedWatch, Watch, WatchType } from '@prisma/client';
import { User, CommandInteraction, EmbedBuilder } from 'discord.js';
import { getExpirationTimestampForSnooze } from './datetime';
import { formatSnoozedWatchResult, removeSnoozedWatchDataFromDbResult } from './helpers';


const prisma = new PrismaClient()

// perhaps there is a way to skip this step, since we have users id'ed by their discordUserId
// find a way to catch the error if their id doesnt exist, then findOrCreate and try again.
export async function findOrCreateUser(discordUser: User) {
    const user = await prisma.user.findUnique({
        where: {
            discordUserId: discordUser.id
        }
    })

    if (user) {
        return user;
    }

    const createdUser = await prisma.user.create({
        data: {
            discordUserId: discordUser.id,
            discordUsername: discordUser.username,
        }
    })

    return createdUser;
}

type CreateWatchInputArgs = {
    itemName: string;
    server: Server;
    watchType: WatchType;
}

export async function upsertWatch(discordUserId: string, watchData: CreateWatchInputArgs) {
    return await prisma.watch.upsert({
        where: {
            discordUserId_itemName_server: {
                discordUserId: discordUserId,
                itemName: watchData.itemName,
                server: watchData.server
            }
        },
        update: {
            itemName: watchData.itemName,
            server: watchData.server,
            active: true,
        },
        create: {
            discordUserId: discordUserId,
            itemName: watchData.itemName,
            server: watchData.server,
            watchType: watchData.watchType,
        },
        include: {
            snoozedWatches: true
        }
    });
}

type MetadataType = {
    id: number;
}

export async function snoozeWatch(metadata: MetadataType) {
    const result = await prisma.snoozedWatch.upsert({
        where: {
            watchId: metadata.id
        },
        update: {
            // technically, this will never get updated as we are
            // responding to an inactive watch snooze event
            endTimestamp: getExpirationTimestampForSnooze(),
            watchId: metadata.id
        },
        create: {
            endTimestamp: getExpirationTimestampForSnooze(),
            watchId: metadata.id
        },
        include: {
            watch: true,
        }
    }); 
    return formatSnoozedWatchResult(result);
};

export async function unsnoozeWatch(metadata: MetadataType) {
    const result = await prisma.snoozedWatch.delete({
        where: {
            watchId: metadata.id
        },
        include: {
            watch: true,
        }
    });
    // prisma's delete returns the deleted entry, which we don't want
    // let's delete it ourselves to save an extra db query
    console.log('result = ', result);
    const accurateData = removeSnoozedWatchDataFromDbResult(result)
    return formatSnoozedWatchResult(accurateData);
};

export async function unwatch(metadata: MetadataType) {
    // Update the watch entry by setting active to false where the id matches metadata.id
    const result = await prisma.watch.update({
        where: {
            id: metadata.id
        },
        data: {
            active: false
        },
        include: {
            snoozedWatches: true,
        }
    });

    
    return result;
}

export async function extendWatch(metadata: MetadataType) {
    // Update the watch entry by setting active to false where the id matches metadata.id
    const result = await prisma.watch.update({
        where: {
            id: metadata.id
        },
        data: {
            created: new Date(),
            active: true
        },
        include: {
            snoozedWatches: true,
        }
    });

    
    return result;
}


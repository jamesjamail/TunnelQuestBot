import { Prisma, SnoozedWatch, Watch } from "@prisma/client";
import { CommandInteraction } from "discord.js";
import { ButtonInteractionTypes } from "../content/buttons/buttonBuilder";

export function getInteractionArgs<T>(interaction: CommandInteraction, argNames: (keyof T)[]): T {
    const result: Partial<T> = {};

    for (const arg of argNames) {
        const option = interaction.options.get(arg as string);

        if (option?.value) {
            result[arg as keyof T] = option.value as any;
        }
    }

    for (const arg of argNames) {
        if (result[arg] === undefined) {
            throw new Error(`Missing required argument: ${String(arg)}`);
        }
    }

    return result as T;
}

type WatchWithSnoozedWatches = Watch & {
    snoozedWatches: SnoozedWatch[];
  };

export function formatTopLevelDbResponses(result: any, modelName: keyof typeof Prisma.ModelName) {
    // Convert the first letter to lowercase
    const formattedModelName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    
    const formattedResult: any = {
        [formattedModelName]: {}
    };

    // Loop over the result's keys
    for (const key of Object.keys(result)) {
        // If the key does not exist in the Prisma.ModelName, we nest it under the modelName.
        // Otherwise, they are treated as related models and kept at the top level.
        if (!(key in Prisma.ModelName)) {
            formattedResult[formattedModelName][key] = result[key];
        } else {
            formattedResult[key] = result[key];
        }
    }

    return formattedResult;
}

export function formatSnoozedWatchResult(data: SnoozedWatch & { watch: Watch }): WatchWithSnoozedWatches {
    console.log('data = ', data)
    // Extracting the watch data from the response
    const { watch, ...snoozedWatchData } = data;
    console.log('snoozedWatchData =', snoozedWatchData)
    // Constructing the new formatted result
    const formattedResult: WatchWithSnoozedWatches = {
        ...watch, // spreading watch data
        snoozedWatches: Object.keys(snoozedWatchData).length ? [{ ...snoozedWatchData }] : []  // if empty obj, use empty array
    };

    return formattedResult;
}

export function getEnumKeyByEnumValue(myEnum: typeof ButtonInteractionTypes, enumValue: string): ButtonInteractionTypes | null {
    const keys = Object.values(myEnum).find(value => value === enumValue);
    return keys ? keys as any as ButtonInteractionTypes : null;
}

export function removeSnoozedWatchDataFromDbResult(dbResult: any): any {
    console.log('db result = ', dbResult)
    const modifiedResult = { ...dbResult }; // Clone the object to avoid mutating the original

    delete modifiedResult.id;
    delete modifiedResult.watchId;
    delete modifiedResult.endTimestamp;

    return modifiedResult;
}
/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageStore } from "@webpack/common";

export interface RecentUser {
    id: string;
    name: string;
}

/** Distinct users who wrote in the channel, newest first. */
export function getRecentChannelUsers(channelId: string, limit = 8): RecentUser[] {
    try {
        const messages = (MessageStore.getMessages(channelId)?._array ?? []) as any[];
        const seen = new Map<string, string>();

        for (let i = messages.length - 1; i >= 0 && seen.size < limit; i--) {
            const author = messages[i]?.author;
            if (!author?.id || author.bot || seen.has(author.id)) continue;

            seen.set(author.id, author.globalName ?? author.username ?? author.id);
        }

        return Array.from(seen, ([id, name]) => ({ id, name }));
    } catch {
        return [];
    }
}

/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageStore, UserStore } from "@webpack/common";

import { googleTranslate } from "../api/google";
import { Logger } from "./logger";

/** Channel id -> language the other participants write in. */
const detected = new Map<string, string>();

export function noteDetectedLanguage(channelId: string, language?: string) {
    if (!channelId || !language || language === "auto") return;

    const normalized = language.toLowerCase();
    if (detected.get(channelId) === normalized) return;

    detected.set(channelId, normalized);
    Logger.debug("Language", "noted channel language", { channelId, language: normalized });
}

export function getDetectedLanguage(channelId: string): string | undefined {
    return detected.get(channelId);
}

/**
 * Detects the language the channel is written in by asking Google about the last
 * message from another user. Used as the outgoing target when no scope sets it.
 */
export async function detectChannelLanguage(channelId: string): Promise<string | undefined> {
    const cached = detected.get(channelId);
    if (cached) return cached;

    try {
        const messages = (MessageStore.getMessages(channelId)?._array ?? []) as any[];
        const me = UserStore.getCurrentUser()?.id;

        const sample = [...messages].reverse().find(message =>
            message?.content
            && message.type === 0
            && !message.author?.bot
            && message.author?.id !== me
            && /\p{L}/u.test(message.content)
        );

        if (!sample) return undefined;

        const result = await googleTranslate(sample.content.slice(0, 400), "auto", "en");
        noteDetectedLanguage(channelId, result.sourceLanguage);

        Logger.debug("Language", "detected from channel message", {
            channelId,
            language: result.sourceLanguage,
            sample: sample.content.slice(0, 80),
        });

        return result.sourceLanguage || undefined;
    } catch (e) {
        Logger.warn("Language", "detection failed", e);
        return undefined;
    }
}

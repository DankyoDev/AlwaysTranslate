/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageStore } from "@webpack/common";

import { Logger, preview } from "../utils/logger";

const MAX_CONTEXT_MESSAGES = 14;
const MAX_CONTEXT_CHARS = 1600;
const MAX_MESSAGE_CHARS = 280;

function participantName(message: any): string {
    return message?.member?.nick
        || message?.author?.globalName
        || message?.author?.username
        || "unknown";
}

function cleanText(content: string): string {
    const text = content.replace(/\s+/g, " ").trim();
    return text.length > MAX_MESSAGE_CHARS ? `${text.slice(0, MAX_MESSAGE_CHARS)}…` : text;
}

function replyTargetId(message: any): string | undefined {
    return message?.referenced_message?.id ?? message?.message_reference?.message_id;
}

function isPlainMessage(message: any): boolean {
    // 0 = default, 19 = reply. Skip system messages, commands and thread stubs.
    return !!message?.content
        && (message.type === 0 || message.type === 19)
        && !message.author?.bot;
}

/**
 * Builds a short, ranked context block for a message.
 *
 * Priorities:
 *  1. The message it replies to (direct reference).
 *  2. The same author's recent messages (their ongoing thread).
 *  3. Direct interactions with the author (they replied, or someone replied to them).
 *  4. The most recent channel flow and the latest message of each recent participant.
 *
 * The text is labelled so the model knows what is background and what is most relevant.
 */
export function buildContextText(channelId: string, beforeMessageId?: string): string {
    if (!channelId) return "";

    let all: any[];
    try {
        all = MessageStore.getMessages(channelId)?._array ?? [];
    } catch {
        return "";
    }

    const usable = all.filter(isPlainMessage);
    if (usable.length < 2) return "";

    const target = beforeMessageId
        ? usable.find(m => m.id === beforeMessageId) ?? MessageStore.getMessage(channelId, beforeMessageId)
        : undefined;

    let end = target ? usable.findIndex(m => m.id === target.id) : usable.length;
    if (end === -1) end = usable.length;

    const prior = usable.slice(Math.max(0, end - 60), end);
    if (!prior.length) return "";

    const indexById = new Map(prior.map((m, i) => [m.id, i]));
    const byId = new Map(prior.map(m => [m.id, m]));
    const authorId = target?.author?.id;
    const picked = new Map<string, { message: any; score: number; }>();

    function add(message: any, score: number) {
        if (!message?.id || !message.content) return;

        const current = picked.get(message.id);
        if (!current || current.score < score) picked.set(message.id, { message, score });
    }

    // 1. The message being replied to
    const replyId = target ? replyTargetId(target) : undefined;
    const replyMessage = replyId ? (byId.get(replyId) ?? target?.referenced_message) : undefined;
    add(replyMessage, 100);

    // 2. The author's own thread
    if (authorId) {
        prior.filter(m => m.author?.id === authorId).slice(-6).forEach(m => add(m, 80));
    }

    // 3. Direct interactions
    const authorMessageIds = new Set(prior.filter(m => m.author?.id === authorId).map(m => m.id));
    for (const message of prior) {
        const ref = replyTargetId(message);
        if (!ref) continue;

        // Someone replied to the author
        if (authorMessageIds.has(ref)) add(message, 90);

        // The author replied to someone else
        if (message.author?.id === authorId) add(byId.get(ref) ?? message.referenced_message, 85);
    }

    // 4. Recent flow + last message of each recent participant
    prior.slice(-6).forEach(m => add(m, 60));

    const recentAuthors = new Set(prior.slice(-12).map(m => m.author?.id).filter(Boolean));
    for (const id of recentAuthors) {
        const last = prior.filter(m => m.author?.id === id).slice(-1)[0];
        add(last, 50);
    }

    const selected = [...picked.values()]
        .sort((a, b) => (indexById.get(a.message.id) ?? 0) - (indexById.get(b.message.id) ?? 0))
        .slice(-MAX_CONTEXT_MESSAGES);

    // Never drop the direct reply target when we hit the limit
    if (replyMessage && !selected.some(s => s.message.id === replyMessage.id)) {
        const entry = picked.get(replyMessage.id);
        if (entry) selected.unshift(entry);
    }

    if (!selected.length) return "";

    const lines: string[] = [];
    let chars = 0;

    for (const { message } of selected) {
        const ref = replyTargetId(message);
        const refMessage = ref ? (byId.get(ref) ?? message.referenced_message) : undefined;
        const replyLabel = refMessage ? ` (replying to ${participantName(refMessage)})` : "";
        const line = `- ${participantName(message)}${replyLabel}: ${cleanText(message.content)}`;

        if (chars + line.length > MAX_CONTEXT_CHARS) break;

        chars += line.length;
        lines.push(line);
    }

    const text = lines.join("\n");

    Logger.debug("Context", "built", {
        channelId,
        beforeMessageId: beforeMessageId ?? "(outgoing)",
        messages: lines.length,
        chars: text.length,
        picked: selected.map(({ message }) => `${participantName(message)}:${preview(message.content, 40)}`),
        text,
    });

    return text;
}

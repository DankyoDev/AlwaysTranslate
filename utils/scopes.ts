/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChannelStore } from "@webpack/common";

import { CustomDictionaryStore } from "../dict";
import {
    addChannel,
    type ChannelConfig,
    clearGuildScope,
    clearUserScope,
    getChannelEntry,
    getGuildScope,
    getUserScope,
    removeChannel,
    type ScopeConfig,
    settings,
    updateChannel,
    updateGuildScope,
    updateUserScope
} from "../settings";
import { applyScopeLayers, channelToScope, glossarySignature, type ResolvedConfigBase, type ScopeKind } from "./scopesPure";

export type { ScopeKind };

export type ResolvedConfig = ResolvedConfigBase & { scope: ScopeKind; glossarySignature: string; };

export interface ResolveContext {
    channelId?: string;
    guildId?: string;
    userId?: string;
    isDM?: boolean;
}

export function isDMChannel(channelId?: string): boolean {
    if (!channelId) return false;

    try {
        return !ChannelStore.getChannel?.(channelId)?.guild_id;
    } catch {
        return false;
    }
}

export function getGuildIdForChannel(channelId?: string): string | undefined {
    if (!channelId) return undefined;

    try {
        return ChannelStore.getChannel?.(channelId)?.guild_id ?? undefined;
    } catch {
        return undefined;
    }
}

export type ScopeTarget =
    | { kind: "channel"; id: string }
    | { kind: "guild"; id: string }
    | { kind: "user-dm"; id: string }
    | { kind: "user-guild"; id: string };

/** Explicit (non inherited) values of a scope, in ScopeConfig shape */
export function readScope(target: ScopeTarget): ScopeConfig {
    switch (target.kind) {
        case "channel": {
            const entry = getChannelEntry(target.id);
            if (!entry) return {};

            return {
                enabled: entry.enabled,
                targetLang: entry.targetLang,
                sourceLang: entry.lang === "auto" ? undefined : entry.lang,
                outgoingLang: entry.outgoingLang,
                engine: entry.engine === "default" ? undefined : entry.engine,
                outgoing: entry.outgoing,
                aiPrompt: entry.aiCustomPrompt,
                outgoingPrompt: entry.outgoingCustomPrompt,
                glossary: entry.glossary,
            };
        }
        case "guild":
            return getGuildScope(target.id) ?? {};
        case "user-dm":
            return getUserScope(target.id, "dm") ?? {};
        case "user-guild":
            return getUserScope(target.id, "guild") ?? {};
    }
}

export function hasScope(target: ScopeTarget): boolean {
    const scope = readScope(target);
    return Object.keys(scope).some(key => scope[key as keyof ScopeConfig] !== undefined);
}

export function writeScope(target: ScopeTarget, patch: Partial<ScopeConfig>) {
    switch (target.kind) {
        case "channel": {
            if (!getChannelEntry(target.id)) addChannel(target.id);

            const channelPatch: Partial<Omit<ChannelConfig, "id">> = {};

            if ("enabled" in patch) channelPatch.enabled = patch.enabled;
            if ("targetLang" in patch) channelPatch.targetLang = patch.targetLang;
            // "auto" is the channel level equivalent of inheriting the source language
            if ("sourceLang" in patch) channelPatch.lang = patch.sourceLang ?? "auto";
            if ("outgoingLang" in patch) channelPatch.outgoingLang = patch.outgoingLang;
            if ("engine" in patch) channelPatch.engine = patch.engine ?? "default";
            if ("outgoing" in patch) channelPatch.outgoing = patch.outgoing;
            if ("aiPrompt" in patch) channelPatch.aiCustomPrompt = patch.aiPrompt;
            if ("outgoingPrompt" in patch) channelPatch.outgoingCustomPrompt = patch.outgoingPrompt;
            if ("glossary" in patch) channelPatch.glossary = patch.glossary;

            updateChannel(target.id, channelPatch);
            break;
        }
        case "guild":
            updateGuildScope(target.id, patch);
            break;
        case "user-dm":
            updateUserScope(target.id, "dm", patch);
            break;
        case "user-guild":
            updateUserScope(target.id, "guild", patch);
            break;
    }
}

export function clearScope(target: ScopeTarget) {
    switch (target.kind) {
        case "channel":
            removeChannel(target.id);
            break;
        case "guild":
            clearGuildScope(target.id);
            break;
        case "user-dm":
            clearUserScope(target.id, "dm");
            break;
        case "user-guild":
            clearUserScope(target.id, "guild");
            break;
    }
}

/**
 * Resolves the effective translation config for a message.
 * Precedence, lowest to highest: global defaults > server > channel > user.
 * Every key is optional, so a scope only overrides what it defines.
 */
export function resolveConfig(ctx: ResolveContext): ResolvedConfig {
    const { store } = settings;
    const isDM = ctx.isDM ?? isDMChannel(ctx.channelId);

    const base: ResolvedConfigBase = {
        enabled: store.translationMode === "global",
        targetLang: store.targetLang || "auto",
        sourceLang: "auto",
        outgoingLang: store.outgoingTargetLang || "auto",
        engine: store.translationEngine,
        outgoing: store.translateOutgoing,
        aiPrompt: "",
        outgoingPrompt: "",
        glossary: { ...CustomDictionaryStore.getInstance().getDict() },
    };

    const layers: Array<[ScopeKind, ScopeConfig | undefined]> = [];

    if (!isDM && ctx.guildId) {
        layers.push(["guild", getGuildScope(ctx.guildId)]);
    }

    if (ctx.channelId) {
        const entry = getChannelEntry(ctx.channelId);
        if (entry) layers.push(["channel", channelToScope(entry, store.translationMode)]);
    }

    if (ctx.userId) {
        layers.push(["user", getUserScope(ctx.userId, isDM ? "dm" : "guild")]);
    }

    const resolved = applyScopeLayers(base, layers);

    return {
        ...resolved,
        glossarySignature: glossarySignature(resolved.glossary),
    };
}

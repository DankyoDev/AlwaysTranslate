/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ChannelConfig, ScopeConfig } from "../settings";

export type ScopeKind = "global" | "guild" | "channel" | "user";

export interface ResolvedConfigBase {
    enabled: boolean;
    targetLang: string;
    sourceLang: string;
    /** Language outgoing messages are translated to. "auto" = source/detected */
    outgoingLang: string;
    engine: string;
    outgoing: boolean;
    aiPrompt: string;
    outgoingPrompt: string;
}

/**
 * Pure merge of scope layers, lowest to highest priority.
 * Kept free of imports so it can be unit tested outside Discord.
 */
export function applyScopeLayers(
    base: ResolvedConfigBase,
    layers: Array<[ScopeKind, ScopeConfig | undefined]>
): ResolvedConfigBase & { scope: ScopeKind; } {
    const resolved: ResolvedConfigBase & { scope: ScopeKind; } = {
        ...base,
        scope: "global",
    };

    for (const [scope, layer] of layers) {
        if (!layer) continue;

        if (layer.enabled !== undefined) resolved.enabled = layer.enabled;
        if (layer.targetLang !== undefined) resolved.targetLang = layer.targetLang;
        if (layer.sourceLang !== undefined) resolved.sourceLang = layer.sourceLang;
        if (layer.outgoingLang !== undefined) resolved.outgoingLang = layer.outgoingLang;
        if (layer.engine !== undefined) resolved.engine = layer.engine;
        if (layer.outgoing !== undefined) resolved.outgoing = layer.outgoing;
        if (layer.aiPrompt !== undefined) resolved.aiPrompt = layer.aiPrompt;
        if (layer.outgoingPrompt !== undefined) resolved.outgoingPrompt = layer.outgoingPrompt;

        resolved.scope = scope;
    }

    if (resolved.engine === "disable") resolved.enabled = false;

    return resolved;
}

/** Maps a channel override to the generic scope shape. */
export function channelToScope(entry: ChannelConfig, translationMode: string): ScopeConfig {
    return {
        enabled: entry.enabled ?? (translationMode === "whitelist" ? true : undefined),
        targetLang: entry.targetLang,
        // "auto" means "don't override", so a server wide source language still applies
        sourceLang: entry.lang === "auto" ? undefined : entry.lang,
        outgoingLang: entry.outgoingLang,
        engine: entry.engine === "default" ? undefined : entry.engine,
        outgoing: entry.outgoing,
        aiPrompt: entry.aiCustomPrompt,
        outgoingPrompt: entry.outgoingCustomPrompt,
    };
}


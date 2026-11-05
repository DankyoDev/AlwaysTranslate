/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";
import type { ReactNode } from "react";

import { GLOBAL_ENGINE_OPTIONS, LANGUAGES } from "./constants";


export interface ChannelConfig {
    id: string;
    /** Their language (source). "auto" = detect */
    lang?: string;
    engine?: string;
    aiCustomPrompt?: string;
    outgoingCustomPrompt?: string;
    /** New scope overrides. undefined = inherit from server/global */
    enabled?: boolean;
    /** My reading language in this channel. undefined = inherit */
    targetLang?: string;
    /** Language my outgoing messages are translated to. undefined = inherit */
    outgoingLang?: string;
    outgoing?: boolean;
    /** Per scope glossary merged over the global dictionary */
    glossary?: Record<string, string>;
}

/**
 * A scope override. Every key is optional: undefined means "inherit from the next scope up".
 * Precedence when resolving a message: user > channel > server > global.
 */
export interface ScopeConfig {
    enabled?: boolean;
    targetLang?: string;
    sourceLang?: string;
    /** Language outgoing messages are translated to. undefined = auto (source or detected) */
    outgoingLang?: string;
    engine?: string;
    outgoing?: boolean;
    aiPrompt?: string;
    outgoingPrompt?: string;
    glossary?: Record<string, string>;
}

export interface UserScopeConfig {
    /** Overrides that apply when this user writes in DMs */
    dm?: ScopeConfig;
    /** Overrides that apply when this user writes in servers */
    guild?: ScopeConfig;
}

export type GeminiQuotaKind = "rpm" | "tpm" | "rpd";

export interface GeminiQuotaLockState {
    rpmUntil?: number;
    tpmUntil?: number;
    rpdUntil?: number;
}

export const settings = definePluginSettings({
    ui_githubLink: {
        type: OptionType.COMPONENT,
        name: "GitHub Link",
        component: (): ReactNode => null,
    },
    ui_overview: {
        type: OptionType.COMPONENT,
        component: (): ReactNode => null,
    },
    header_translation: {
        type: OptionType.COMPONENT,
        component: (): ReactNode => null,
    },
    targetLang: {
        type: OptionType.SELECT,
        default: "auto",
        displayName: "Mi idioma de lectura",
        description: "Idioma de los mensajes que recibes.",
        options: LANGUAGES.map(l => l.value === "auto" ? { ...l, label: "Idioma de Discord", default: true } : l),
    },

    translationMode: {
        type: OptionType.SELECT,
        default: "whitelist",
        displayName: "Ámbito de traducción automática",
        description: "Canales que se traducen automáticamente.",
        options: [
            { label: "Todos los canales", value: "global" },
            { label: "Solo canales seleccionados", value: "whitelist", default: true }
        ],
    },
    translationEngine: {
        type: OptionType.SELECT,
        default: "google",
        displayName: "Motor automático por defecto",
        description: "Motor por defecto. Los overrides por canal se aplican aparte. Google no necesita clave.",
        options: GLOBAL_ENGINE_OPTIONS.map(o => ({ ...o, label: o.value === "disable" ? "Desactivado" : o.label, default: o.value === "google" })),
    },
    manualTranslationEngine: {
        type: OptionType.SELECT,
        default: "google",
        displayName: "Motor del botón manual",
        description: "Motor del botón «Traducir ahora». Google no necesita clave.",
        options: GLOBAL_ENGINE_OPTIONS.map(o => ({ ...o, label: o.value === "disable" ? "Desactivado" : o.label, default: o.value === "google" })),
    },
    deeplApiKey: {
        type: OptionType.CUSTOM,
        default: "",
    },
    ui_apiKeys: {
        type: OptionType.COMPONENT,
        name: "API Keys",
        component: (): ReactNode => null,
    },

    geminiApiKey: {
        type: OptionType.CUSTOM,
        default: "",
    },
    geminiModel: {
        type: OptionType.CUSTOM,
        default: "gemini-2.5-flash-lite",
    },
    deepseekApiKey: {
        type: OptionType.CUSTOM,
        default: "",
    },
    deepseekBaseUrl: {
        type: OptionType.CUSTOM,
        default: "https://api.deepseek.com/chat/completions",
    },
    deepseekModel: {
        type: OptionType.CUSTOM,
        default: "deepseek-v4-flash",
    },
    geminiQuotaLocks: {
        type: OptionType.CUSTOM,
        default: {} as Record<string, GeminiQuotaLockState>,
    },
    ui_presets: {
        type: OptionType.COMPONENT,
        component: (): ReactNode => null,
    },
    APIEcoModeThreshold: {
        type: OptionType.CUSTOM,
        default: 3,
    },
    APIMaxBatchWait: {
        type: OptionType.CUSTOM,
        default: 10,
    },

    header_management: {
        type: OptionType.COMPONENT,
        component: (): ReactNode => null,
    },
    channelList: {
        type: OptionType.CUSTOM,
        default: [] as ChannelConfig[],
    },
    guildOverrides: {
        type: OptionType.CUSTOM,
        default: {} as Record<string, ScopeConfig>,
    },
    userOverrides: {
        type: OptionType.CUSTOM,
        default: {} as Record<string, UserScopeConfig>,
    },
    channelManager: {
        type: OptionType.COMPONENT,
        // Assigned dynamically in index.tsx to avoid circular imports
        component: (): ReactNode => null,
    },
    translateOutgoing: {
        type: OptionType.BOOLEAN,
        default: false,
        displayName: "Traducir mensajes salientes",
        description: "Traducir antes de enviar. El idioma de destino se elige en «Idioma de destino de mis mensajes».",
    },
    outgoingTargetLang: {
        type: OptionType.SELECT,
        default: "auto",
        displayName: "Idioma de destino de mis mensajes",
        description: "Idioma al que se traducen tus mensajes salientes. Auto usa el idioma del canal o el detectado.",
        options: [
            { label: "Auto (idioma del canal)", value: "auto", default: true },
            ...LANGUAGES.filter(l => l.value !== "auto"),
        ],
    },
    previewOutgoing: {
        type: OptionType.BOOLEAN,
        default: false,
        displayName: "Previsualizar antes de enviar",
        description: "Muestra el texto traducido en el chat antes de enviarlo.",
    },
    skipOwnMessages: {
        type: OptionType.BOOLEAN,
        default: true,
        displayName: "No traducir mis propios mensajes",
        description: "No traducir tus mensajes.",
    },

    ignorePrefix: {
        type: OptionType.STRING,
        default: "!",
        displayName: "Prefijo para no traducir",
        description: "No traducir mensajes que empiecen por esto.",
    },

    header_dictionary: {
        type: OptionType.COMPONENT,
        component: (): ReactNode => null,
    },
    customDictionary: {
        type: OptionType.CUSTOM,
        default: {} as Record<string, string>,
    },
    dictionaryCaseSensitive: {
        type: OptionType.BOOLEAN,
        default: false,
        displayName: "Diccionario sensible a mayúsculas",
        description: "Distinguir mayúsculas y minúsculas.",
    },
    dictionaryManager: {
        type: OptionType.COMPONENT,
        component: (): ReactNode => null,
    },

    header_design: {
        type: OptionType.COMPONENT,
        component: (): ReactNode => null,
    },

    showSeparator: {
        type: OptionType.BOOLEAN,
        default: true,
        displayName: "Mostrar línea separadora",
        description: "Mostrar una línea encima de las traducciones.",
    },
    hideOriginal: {
        type: OptionType.BOOLEAN,
        default: false,
        displayName: "Ocultar mensaje original",
        description: "Oculta el texto original.",
    },
    hideEmojis: {
        type: OptionType.BOOLEAN,
        default: false,
        displayName: "Ocultar emojis",
        description: "Eliminar los emojis de la traducción.",
    },
    hideMentions: {
        type: OptionType.BOOLEAN,
        default: false,
        displayName: "Ocultar menciones",
        description: "Eliminar las @menciones de la traducción.",
    },
    translationColor: {
        type: OptionType.CUSTOM,
        default: "",
    },
    ui_translationColor: {
        type: OptionType.COMPONENT,
        component: (): ReactNode => null,
    },
    _cacheVersion: {
        type: OptionType.CUSTOM,
        default: 0,
    },
    ui_clearCache: {
        type: OptionType.COMPONENT,
        component: (): ReactNode => null,
    },
    debugLog: {
        type: OptionType.BOOLEAN,
        default: false,
        displayName: "Registro de depuración",
        description: "Escribe cada paso de la traducción en AlwaysTranslate.log. Las claves de API nunca se registran.",
    },
    ui_debugLog: {
        type: OptionType.COMPONENT,
        component: (): ReactNode => null,
    },
});

// ─── Helper functions ───
// Always read from `settings.plain` when building the next value: spreading a proxied
// object copies proxy-wrapped children, which then fail Electron's IPC structured clone
// when the settings are written to disk (and the write throws before listeners fire).

export function getChannelEntry(channelId: string): ChannelConfig | undefined {
    return settings.plain.channelList.find(c => c.id === channelId);
}

/** Immutably update a single channel's properties. */
export function updateChannel(
    channelId: string,
    updater: Partial<Omit<ChannelConfig, "id">>
) {
    const { channelList } = settings.plain;
    if (!channelList.some(c => c.id === channelId)) return;

    settings.store.channelList = channelList.map(c => c.id === channelId ? { ...c, ...updater } : c);
}

/** Immutably add a channel to the list. */
export function addChannel(id: string, lang = "auto", patch: Partial<Omit<ChannelConfig, "id" | "lang">> = {}) {
    const { channelList } = settings.plain;
    if (channelList.some(c => c.id === id)) return;

    settings.store.channelList = [...channelList, { id, lang, ...patch }];
}

/** Immutably remove a channel from the list. */
export function removeChannel(id: string) {
    settings.store.channelList = settings.plain.channelList.filter(c => c.id !== id);
}

export function getGuildScope(guildId: string): ScopeConfig | undefined {
    return settings.plain.guildOverrides[guildId];
}

export function updateGuildScope(guildId: string, patch: Partial<ScopeConfig>) {
    const current = settings.plain.guildOverrides[guildId] ?? {};
    const next: ScopeConfig = { ...current, ...patch };

    for (const key of Object.keys(next) as (keyof ScopeConfig)[]) {
        if (next[key] === undefined) delete next[key];
    }

    settings.store.guildOverrides = { ...settings.plain.guildOverrides, [guildId]: next };
}

export function clearGuildScope(guildId: string) {
    const { [guildId]: _removed, ...rest } = settings.plain.guildOverrides;
    settings.store.guildOverrides = rest;
}

export function getUserScope(userId: string, kind: "dm" | "guild"): ScopeConfig | undefined {
    return settings.plain.userOverrides[userId]?.[kind];
}

export function updateUserScope(userId: string, kind: "dm" | "guild", patch: Partial<ScopeConfig>) {
    const current = settings.plain.userOverrides[userId] ?? {};
    const scope: ScopeConfig = { ...(current[kind] ?? {}), ...patch };

    for (const key of Object.keys(scope) as (keyof ScopeConfig)[]) {
        if (scope[key] === undefined) delete scope[key];
    }

    settings.store.userOverrides = {
        ...settings.plain.userOverrides,
        [userId]: { ...current, [kind]: scope },
    };
}

export function clearUserScope(userId: string, kind: "dm" | "guild") {
    const current = settings.plain.userOverrides[userId];
    if (!current) return;

    const scope = { ...current };
    delete scope[kind];

    const userOverrides = { ...settings.plain.userOverrides };
    if (!scope.dm && !scope.guild) delete userOverrides[userId];
    else userOverrides[userId] = scope;

    settings.store.userOverrides = userOverrides;
}

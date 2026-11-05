/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const CACHE_MAX_SIZE = 1000;
export const CACHE_PERSISTENT_MAX_SIZE = 50000;
export const CACHE_SAVE_DEBOUNCE = 5000; // ms
export const GEMINI_BATCH_SIZE = 1000;
export const MAX_TRANSLATION_CHARS = 6000;
export const GEMINI_TEMPERATURE = 0.3;
export const BATCH_ACCUMULATION_TIME_GEMINI = 200; // ms – debounce interval per new message

export const LANGUAGES = [
    { label: "Detectar", value: "auto" },
    { label: "Árabe", value: "ar" },
    { label: "Búlgaro", value: "bg" },
    { label: "Chino (simplificado)", value: "zh-CN" },
    { label: "Chino (tradicional, Taiwán)", value: "zh-TW" },
    { label: "Checo", value: "cs" },
    { label: "Danés", value: "da" },
    { label: "Neerlandés", value: "nl" },
    { label: "Inglés", value: "en" },
    { label: "Finés", value: "fi" },
    { label: "Francés", value: "fr" },
    { label: "Alemán", value: "de" },
    { label: "Griego", value: "el" },
    { label: "Húngaro", value: "hu" },
    { label: "Indonesio", value: "id" },
    { label: "Italiano", value: "it" },
    { label: "Japonés", value: "ja" },
    { label: "Coreano", value: "ko" },
    { label: "Lituano", value: "lt" },
    { label: "Noruego", value: "no" },
    { label: "Polaco", value: "pl" },
    { label: "Portugués", value: "pt" },
    { label: "Rumano", value: "ro" },
    { label: "Ruso", value: "ru" },
    { label: "Español", value: "es" },
    { label: "Sueco", value: "sv" },
    { label: "Turco", value: "tr" },
    { label: "Ucraniano", value: "uk" },
] as const;

export type LangCode = typeof LANGUAGES[number]["value"];

export const GLOBAL_ENGINE_OPTIONS = [
    { label: "Desactivado", value: "disable" },
    { label: "Google Translate", value: "google" },
    { label: "Gemini", value: "gemini" },
    { label: "DeepSeek", value: "deepseek" },
];

export const CHANNEL_ENGINE_OPTIONS = [
    { label: "Desactivado", value: "disable" },
    { label: "Predeterminado", value: "default" },
    ...GLOBAL_ENGINE_OPTIONS.filter(o => o.value !== "disable")
];

export const TRANSLATION_PRESETS = [
    { name: "Real-time", threshold: 1, wait: 0 },
    { name: "Balanced", threshold: 3, wait: 10 },
    { name: "Economy", threshold: 10, wait: 30 },
    { name: "Sleep", threshold: 250, wait: 0 }
];

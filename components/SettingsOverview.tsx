/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { GLOBAL_ENGINE_OPTIONS, LANGUAGES } from "../constants";
import { settings } from "../settings";
import { useApiKeys } from "../utils/secrets";
import { Forms } from "./LegacyWebpack";

export function SettingsOverview() {
    const { translationEngine = "google", manualTranslationEngine = "google", targetLang = "auto", channelList } = settings.use([
        "translationEngine", "manualTranslationEngine", "targetLang", "channelList"
    ]);
    const keys = useApiKeys();
    const engineLabel = (engine: string) => engine === "disable" ? "Desactivado" : GLOBAL_ENGINE_OPTIONS.find(o => o.value === engine)?.label || engine;
    const resolvedLanguage = targetLang === "auto" ? document.documentElement.lang.split("-")[0] || "en" : targetLang;
    const language = LANGUAGES.find(l => l.value === resolvedLanguage)?.label || resolvedLanguage;
    const engines = new Set([translationEngine, manualTranslationEngine, ...channelList.map(c => c.engine || "default")]);
    const missing = [{ id: "gemini", label: "Gemini", key: keys.gemini }, { id: "deepseek", label: "DeepSeek", key: keys.deepseek }, { id: "deepl", label: "DeepL", key: keys.deepl }]
        .filter(e => engines.has(e.id) && !e.key.trim()).map(e => e.label);
    return (
        <section style={{ marginBottom: 16 }} aria-label="Resumen de traducción">
            <Forms.FormText>
                Automático: {engineLabel(translationEngine)} · Manual: {engineLabel(manualTranslationEngine)} · {language}
            </Forms.FormText>
            {missing.length > 0 && <Forms.FormText>Falta la clave de API: {missing.join(", ")}</Forms.FormText>}
        </section>
    );
}

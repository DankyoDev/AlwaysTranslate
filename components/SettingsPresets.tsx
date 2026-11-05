/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { SearchableSelect, TextInput } from "@webpack/common";

import { reScheduleAllWorkers } from "../api/translate";
import { settings } from "../settings";
import { Forms } from "./LegacyWebpack";

const presets = [
    { name: "Tiempo real", threshold: 1, wait: 0 },
    { name: "Equilibrado", threshold: 3, wait: 10 },
    { name: "Económico", threshold: 10, wait: 30 },
    { name: "Dormido", threshold: 250, wait: 0 }
];

export function SettingsPresets() {
    const { APIEcoModeThreshold: threshold, APIMaxBatchWait: wait } = settings.use(["APIEcoModeThreshold", "APIMaxBatchWait"]);
    const current = presets.find(p => p.threshold === threshold && p.wait === wait);
    const update = (count: number, seconds: number) => {
        settings.store.APIEcoModeThreshold = count;
        settings.store.APIMaxBatchWait = seconds;
        reScheduleAllWorkers();
    };

    return (
        <section className="bat-settings-section">
            <Forms.FormTitle>Cadencia de traducción</Forms.FormTitle>
            <Forms.FormText>Agrupación de Gemini y DeepSeek.</Forms.FormText>
            <div style={{ marginTop: 8 }}>
                <SearchableSelect
                    value={current?.name ?? "Personalizado"}
                    options={[...presets.map(p => ({ label: p.name, value: p.name })), { label: "Personalizado", value: "Personalizado" }]}
                    onChange={(value: string) => {
                        const preset = presets.find(p => p.name === value);
                        if (preset) update(preset.threshold, preset.wait);
                    }}
                />
            </div>
            <div className="bat-settings-fields">
                <div>
                    <Forms.FormTitle>Mensajes</Forms.FormTitle>
                    <TextInput type="number" value={String(threshold)} onChange={(value: string) => {
                        const count = Number(value);
                        if (value && Number.isInteger(count) && count >= 1 && count <= 1000) update(count, wait);
                    }} />
                </div>
                <div>
                    <Forms.FormTitle>Espera (segundos)</Forms.FormTitle>
                    <TextInput type="number" value={String(wait)} onChange={(value: string) => {
                        const seconds = Number(value);
                        if (value && Number.isInteger(seconds) && seconds >= 0 && seconds <= 300) update(threshold, seconds);
                    }} />
                </div>
            </div>
            <Forms.FormText>0 segundos: esperar al número de mensajes.</Forms.FormText>
        </section>
    );
}

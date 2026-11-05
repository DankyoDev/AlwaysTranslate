/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ColorPicker } from "@webpack/common";

import { settings } from "../settings";
import { Forms } from "./LegacyWebpack";

export function ColorPickerInput() {
    const { translationColor } = settings.use(["translationColor"]);

    let numColor = 10157977; // #9aff99
    try {
        if (translationColor) {
            numColor = parseInt(translationColor.replace("#", ""), 16);
            if (isNaN(numColor)) numColor = 10157977;
        }
    } catch {}

    const handleChange = (c: number | null) => {
        settings.store.translationColor = "#" + (c ?? 10157977).toString(16).padStart(6, "0");
    };

    return (
        <section style={{ marginBottom: "20px" }}>
            <Forms.FormTitle>Color de la traducción</Forms.FormTitle>
            <Forms.FormText style={{ marginBottom: "8px" }}>
                Elige el color del texto traducido
            </Forms.FormText>
            <ColorPicker
                suggestedColors={["#9aff99", "#ffffff", "#ff0000", "#ffff00", "#00ffff", "#ff00ff"]}
                color={numColor}
                onChange={handleChange}
            />
        </section>
    );
}

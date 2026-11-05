/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useState } from "@webpack/common";

import { settings } from "../settings";
import { TranslationCache } from "../utils/cache";
import { showTranslationToast } from "../utils/toast";
import { Button, Forms } from "./LegacyWebpack";

export function ClearCacheButton() {
    const [count, setCount] = useState(() => TranslationCache.getInstance().getTotalCount());

    return (
        <section style={{ marginBottom: "20px" }}>
            <Forms.FormTitle>Limpiar caché</Forms.FormTitle>
            <Forms.FormText style={{ marginBottom: "8px" }}>
                Borra todos los datos de traducción guardados en memoria y disco.
            </Forms.FormText>
            <Button
                color={Button.Colors.RED}
                style={{ minWidth: "200px" }}
                onClick={() => {
                    TranslationCache.getInstance().clearAll();
                    settings.store.geminiQuotaLocks = {};
                    settings.store._cacheVersion = (settings.store._cacheVersion || 0) + 1;
                    setCount(0);
                    showTranslationToast("Se han borrado todas las cachés de traducción.", "success");
                }}
            >
                Borrar todas las cachés ({count})
            </Button>
        </section>
    );
}

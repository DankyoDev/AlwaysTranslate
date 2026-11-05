/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PluginNative } from "@utils/types";
import { useEffect, useState } from "@webpack/common";

import { settings } from "../settings";
import { showTranslationToast } from "../utils/toast";
import { Button, Forms } from "./LegacyWebpack";

const Native = VencordNative.pluginHelpers.AlwaysTranslate as PluginNative<typeof import("../native")>;

export function DebugLogSection() {
    const { debugLog } = settings.use(["debugLog"]);
    const [path, setPath] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        Promise.resolve(Native.batLogPath?.())
            .then(value => typeof value === "string" && setPath(value))
            .catch(() => { });
    }, []);

    async function clear() {
        if (busy) return;
        setBusy(true);

        try {
            const ok = await Native.batLogClear?.();
            showTranslationToast(ok ? "Log de depuración borrado" : "No se pudo borrar el log", ok ? "success" : "critical");
        } catch {
            showTranslationToast("No se pudo borrar el log");
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="bat-settings-section" aria-label="Registro de depuración">
            <Forms.FormTitle>Registro de depuración</Forms.FormTitle>
            <Forms.FormText>
                {debugLog
                    ? "Activado. Cada petición, bloque de contexto, respuesta del modelo y decisión se añaden al archivo."
                    : "Desactivado. Activa el interruptor de arriba para registrar cada paso de la traducción."}
            </Forms.FormText>
            <Forms.FormText>
                Las claves de API nunca se escriben. Los mensajes se recortan para que el archivo sea legible.
            </Forms.FormText>

            {path && (
                <Forms.FormText style={{ fontSize: 12, color: "var(--text-muted)", wordBreak: "break-all", marginTop: 4 }}>
                    {path}
                </Forms.FormText>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Button
                    size={Button.Sizes.SMALL}
                    color={Button.Colors.PRIMARY}
                    onClick={() => { void Native.batLogOpen?.(); }}
                >
                    Abrir archivo de log
                </Button>
                <Button
                    size={Button.Sizes.SMALL}
                    color={Button.Colors.RED}
                    disabled={busy}
                    onClick={clear}
                >
                    {busy ? "Limpiando…" : "Limpiar log"}
                </Button>
            </div>
        </section>
    );
}

/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { TextInput, useState } from "@webpack/common";

import { translateWithDeepL } from "../api/deepl";
import { translateBatchWithDeepSeek } from "../api/deepseek";
import { translateBatchWithGemini } from "../api/gemini";
import { settings } from "../settings";
import { getSecret, isSecretStorageAvailable, setSecret, useApiKeys } from "../utils/secrets";
import { Button, Forms } from "./LegacyWebpack";

type TestStatus = "idle" | "success" | "error";

const inputStyle = { flex: "1 1 220px", minWidth: 0 };

function Field({ label, hint, children }: { label: string; hint?: string; children: any; }) {
    return (
        <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                {label}
            </div>
            {children}
            {hint && <Forms.FormText style={{ marginTop: 4 }}>{hint}</Forms.FormText>}
        </div>
    );
}

function Provider({ title, configured, help, children }: {
    title: string;
    configured: boolean;
    help?: string;
    children?: any;
}) {
    return (
        <section style={{ padding: "16px 0", borderBottom: "1px solid var(--background-modifier-accent)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <Forms.FormTitle style={{ margin: 0 }}>{title}</Forms.FormTitle>
                <span style={{ fontSize: 12, fontWeight: 700, color: configured ? "var(--text-positive)" : "var(--text-muted)" }}>
                    {configured ? "configurada" : "sin clave"}
                </span>
            </div>
            {help && <Forms.FormText style={{ marginTop: 4 }}>{help}</Forms.FormText>}
            {children}
        </section>
    );
}

function ApiKeyRow({ value, placeholder, onChange, onTest }: {
    value: string;
    placeholder: string;
    onChange(value: string): void;
    onTest(): Promise<void>;
}) {
    const [show, setShow] = useState(false);
    const [validating, setValidating] = useState(false);
    const [status, setStatus] = useState<TestStatus>("idle");
    const [error, setError] = useState("");

    async function test() {
        setValidating(true);
        setStatus("idle");
        setError("");

        try {
            await onTest();
            setStatus("success");
        } catch (e: any) {
            setStatus("error");
            setError(e?.detail ? `${e.message} — ${e.detail}` : (e?.message ?? String(e)));
        } finally {
            setValidating(false);
        }
    }

    return (
        <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <div style={inputStyle}>
                    <TextInput
                        type={show ? "text" : "password"}
                        value={value}
                        onChange={(v: string) => {
                            onChange(v);
                            setStatus("idle");
                        }}
                        placeholder={placeholder}
                    />
                </div>

                <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => setShow(s => !s)}>
                    {show ? "Ocultar" : "Mostrar"}
                </Button>

                <Button
                    size={Button.Sizes.SMALL}
                    color={status === "success" ? Button.Colors.GREEN : status === "error" ? Button.Colors.RED : Button.Colors.PRIMARY}
                    disabled={validating || !value.trim()}
                    onClick={test}
                >
                    {validating ? "Probando…" : status === "success" ? "Válida" : status === "error" ? "Falló" : "Probar clave"}
                </Button>
            </div>

            {status === "error" && (
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-danger)", wordBreak: "break-word" }}>{error}</div>
            )}
            {status === "success" && (
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-positive)" }}>La clave funciona.</div>
            )}
        </div>
    );
}

export function ApiKeysManager() {
    const [expanded, setExpanded] = useState(true);
    const keys = useApiKeys();
    const secure = isSecretStorageAvailable();

    const { geminiModel, deepseekModel, deepseekBaseUrl, translationEngine } = settings.use([
        "geminiModel", "deepseekModel", "deepseekBaseUrl", "translationEngine",
    ]);

    const missingForEngine =
        translationEngine === "gemini" && !keys.gemini ? "Gemini"
            : translationEngine === "deepseek" && !keys.deepseek ? "DeepSeek"
                : translationEngine === "deepl" && !keys.deepl ? "DeepL"
                    : null;

    return (
        <section className="bat-settings-section" aria-label="API keys">
            <Forms.FormText style={{ marginBottom: 8 }}>
                Google Translate needs no key. Las claves se cifran con el llavero del sistema (DPAPI en Windows) y nunca se escriben en settings.json.
                {!secure && " El cifrado aún no está disponible: reinicia Discord una vez para cargar el código nativo nuevo."}
            </Forms.FormText>

            {missingForEngine && (
                <Forms.FormText style={{ marginBottom: 8, color: "var(--text-danger)" }}>
                    Tu motor automático es {missingForEngine}, pero su clave de API está vacía.
                </Forms.FormText>
            )}

            <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => setExpanded(v => !v)}>
                {expanded ? "Ocultar claves de API" : "Mostrar claves de API"}
            </Button>

            {expanded && (
                <div>
                    <Provider
                        title="Google Translate"
                        configured
                        help="Endpoint gratuito, sin cuenta. Es el motor por defecto."
                    />

                    <Provider
                        title="Gemini"
                        configured={!!keys.gemini}
                        help="Consigue una clave en aistudio.google.com/apikey. El modelo debe soportar generateContent."
                    >
                        <ApiKeyRow
                            value={keys.gemini}
                            placeholder="AIza..."
                            onChange={v => setSecret("gemini", v)}
                            onTest={async () => {
                                await translateBatchWithGemini("0", [{ id: "0", text: "hello" }], "es", getSecret("gemini"), "", geminiModel);
                            }}
                        />
                        <Field label="Modelo" hint="Ejemplos: gemini-2.5-flash-lite, gemini-2.5-flash, gemini-2.5-pro. Prueba la clave tras cambiarlo.">
                            <TextInput
                                value={geminiModel}
                                onChange={(v: string) => { settings.store.geminiModel = v.trim(); }}
                                placeholder="gemini-2.5-flash-lite"
                            />
                        </Field>
                    </Provider>

                    <Provider
                        title="DeepSeek"
                        configured={!!keys.deepseek}
                        help="Consigue una clave en platform.deepseek.com/api_keys."
                    >
                        <ApiKeyRow
                            value={keys.deepseek}
                            placeholder="sk-..."
                            onChange={v => setSecret("deepseek", v)}
                            onTest={async () => {
                                await translateBatchWithDeepSeek(
                                    "0",
                                    [{ id: "0", text: "hello" }],
                                    "es",
                                    getSecret("deepseek"),
                                    "",
                                    deepseekModel,
                                    undefined,
                                    deepseekBaseUrl
                                );
                            }}
                        />
                        <Field label="Modelo">
                            <TextInput
                                value={deepseekModel}
                                onChange={(v: string) => { settings.store.deepseekModel = v.trim(); }}
                                placeholder="deepseek-chat"
                            />
                        </Field>
                        <Field label="URL base" hint="Cámbiala solo si usas un proxy compatible.">
                            <TextInput
                                value={deepseekBaseUrl}
                                onChange={(v: string) => { settings.store.deepseekBaseUrl = v.trim(); }}
                                placeholder="https://api.deepseek.com/chat/completions"
                            />
                        </Field>
                    </Provider>

                    <Provider
                        title="DeepL"
                        configured={!!keys.deepl}
                        help="Consigue una clave en deepl.com/pro-api. Las gratuitas terminan en :fx."
                    >
                        <ApiKeyRow
                            value={keys.deepl}
                            placeholder="xxxxxxxx-xxxx-...:fx"
                            onChange={v => setSecret("deepl", v)}
                            onTest={async () => {
                                await translateWithDeepL(["test"], "auto", "en", getSecret("deepl"));
                            }}
                        />
                    </Provider>
                </div>
            )}
        </section>
    );
}

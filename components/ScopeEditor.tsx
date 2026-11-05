/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Modal, openModal, TextArea, TextInput, useState } from "@webpack/common";

import { GLOBAL_ENGINE_OPTIONS, LANGUAGES } from "../constants";
import type { ScopeConfig } from "../settings";
import { Logger } from "../utils/logger";
import { clearScope, readScope, ScopeTarget, writeScope } from "../utils/scopes";
import { Dropdown } from "./Dropdown";
import { Button, Forms } from "./LegacyWebpack";

const INHERIT = "__inherit";

const triStateOptions = [
    { label: "Heredar", value: INHERIT },
    { label: "Sí", value: "on" },
    { label: "No", value: "off" },
];

const languageOptions = [
    { label: "Heredar", value: INHERIT },
    { label: "Idioma de Discord", value: "auto" },
    ...LANGUAGES.filter(l => l.value !== "auto").map(l => ({ label: l.label, value: l.value })),
];

const engineOptions = [
    { label: "Heredar", value: INHERIT },
    ...GLOBAL_ENGINE_OPTIONS.map(o => ({ label: o.label, value: o.value })),
];

const outgoingLanguageOptions = [
    { label: "Heredar", value: INHERIT },
    { label: "Auto (idioma del canal)", value: "auto" },
    ...LANGUAGES.filter(l => l.value !== "auto").map(l => ({ label: l.label, value: l.value })),
];

function Field({ label, hint, children }: { label: string; hint?: string; children: any; }) {
    return (
        <div style={{ marginBottom: 12 }}>
            <Forms.FormText style={{ marginBottom: 4 }}>{label}</Forms.FormText>
            {children}
            {hint && <Forms.FormText style={{ marginTop: 4 }}>{hint}</Forms.FormText>}
        </div>
    );
}

function triValue(value?: boolean) {
    return value === undefined ? INHERIT : value ? "on" : "off";
}

function triFromValue(value: string) {
    if (value === INHERIT) return undefined;
    return value === "on";
}

function SelectField({ label, options, value, onChange, hint }: {
    label: string;
    options: Array<{ label: string; value: string; }>;
    value: string;
    onChange(value: string): void;
    hint?: string;
}) {
    return (
        <Field label={label} hint={hint}>
            <Dropdown options={options} value={value} onChange={onChange} />
        </Field>
    );
}

function ScopeFields({ target, label, showSource = true, showOutgoing = true, showPrompts = false }: {
    target: ScopeTarget;
    label: string;
    showSource?: boolean;
    showOutgoing?: boolean;
    showPrompts?: boolean;
}) {
    // Derive from the settings store on every render so the UI always reflects what
    // was actually persisted (never a stale local copy).
    const [, bump] = useState(0);
    const scope = readScope(target);

    function update(patch: Partial<ScopeConfig>) {
        writeScope(target, patch);
        bump(v => v + 1);
        Logger.debug("Scope", "updated", { target: target.kind, id: target.id, patch, stored: readScope(target) });
    }

    function reset() {
        clearScope(target);
        bump(v => v + 1);
    }

    const empty = Object.keys(scope).length === 0;

    return (
        <section style={{ marginBottom: 24 }}>
            <Forms.FormTitle>{label}</Forms.FormTitle>

            <SelectField
                label="Traducir"
                options={triStateOptions}
                value={triValue(scope.enabled)}
                onChange={v => update({ enabled: triFromValue(v) })}
            />

            <SelectField
                label="Mi idioma (lo que leo)"
                options={languageOptions}
                value={scope.targetLang ?? INHERIT}
                onChange={v => update({ targetLang: v === INHERIT ? undefined : v })}
            />

            {showSource && (
                <SelectField
                    label="Su idioma (lo que escriben)"
                    options={languageOptions}
                    value={scope.sourceLang ?? INHERIT}
                    onChange={v => update({ sourceLang: v === INHERIT ? undefined : v })}
                />
            )}

            <SelectField
                label="Motor (traducción automática)"
                options={engineOptions}
                value={scope.engine ?? INHERIT}
                onChange={v => update({ engine: v === INHERIT ? undefined : v })}
            />

            {showOutgoing && (
                <>
                    <SelectField
                        label="Traducir mis mensajes salientes"
                        options={triStateOptions}
                        value={triValue(scope.outgoing)}
                        onChange={v => update({ outgoing: triFromValue(v) })}
                    />
                    <SelectField
                        label="Idioma de destino de mis mensajes"
                        hint="Idioma al que se traducen tus mensajes salientes. Auto usa el idioma del canal o el detectado."
                        options={outgoingLanguageOptions}
                        value={scope.outgoingLang ?? INHERIT}
                        onChange={v => update({ outgoingLang: v === INHERIT ? undefined : v })}
                    />
                </>
            )}

            {showPrompts && (
                <>
                    <Field label="Prompt de IA para mensajes entrantes (Gemini/DeepSeek)">
                        <TextInput
                            value={scope.aiPrompt ?? ""}
                            onChange={v => update({ aiPrompt: v || undefined })}
                            placeholder="p. ej. Mantén el tono original"
                        />
                    </Field>
                    <Field label="Prompt de IA para mensajes salientes">
                        <TextInput
                            value={scope.outgoingPrompt ?? ""}
                            onChange={v => update({ outgoingPrompt: v || undefined })}
                            placeholder="p. ej. Usa un tono amable"
                        />
                    </Field>
                </>
            )}

            <div style={{ display: "flex", gap: 8 }}>
                <Button
                    size={Button.Sizes.SMALL}
                    color={Button.Colors.RED}
                    disabled={empty}
                    onClick={reset}
                >
                    Borrar override
                </Button>
            </div>
        </section>
    );
}

function ScopeEditorModal({ kind, id, title, ...modalProps }: any) {
    const scopeLabel = kind === "channel" ? "Canal" : kind === "guild" ? "Servidor" : "Usuario";
    const help = kind === "user"
        ? "Los overrides de usuario siempre tienen prioridad sobre canal y servidor."
        : "Deja un campo en Heredar para usar el valor del ámbito superior.";

    return (
        <Modal
            {...modalProps}
            size="md"
            title={title ?? "AlwaysTranslate"}
            subtitle={
                <div>
                    <div>{help}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)", wordBreak: "break-all" }}>
                        {scopeLabel}: {id}
                    </div>
                </div>
            }
            actions={[{ text: "Hecho", variant: "primary", onClick: modalProps.onClose }]}
        >
            {kind === "channel" && (
                <ScopeFields target={{ kind: "channel", id }} label="Este canal" showPrompts />
            )}

            {kind === "guild" && (
                <ScopeFields target={{ kind: "guild", id }} label="Este servidor" />
            )}

            {kind === "user" && (
                <>
                    <ScopeFields target={{ kind: "user-guild", id }} label="Cuando escribe en servidores" showOutgoing={false} />
                    <ScopeFields target={{ kind: "user-dm", id }} label="Cuando escribe en MD" showOutgoing={false} />
                </>
            )}
        </Modal>
    );
}

export function openScopeEditor(kind: "channel" | "guild" | "user", id: string, title?: string) {
    const stored = kind === "user"
        ? { dm: readScope({ kind: "user-dm", id }), guild: readScope({ kind: "user-guild", id }) }
        : readScope({ kind, id });
    Logger.info("Scope", "opening editor", { kind, id, stored });

    openModal((modalProps: any) => <ScopeEditorModal {...modalProps} kind={kind} id={id} title={title} />);
}

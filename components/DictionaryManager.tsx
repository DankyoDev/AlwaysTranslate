/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Divider } from "@components/Divider";
import { TextInput, useState } from "@webpack/common";

import { useDictionary } from "../dict";
import { Button, Forms } from "./LegacyWebpack";

export function DictionaryManager() {
    const [original, setOriginal] = useState("");
    const [translated, setTranslated] = useState("");

    const { dict, add, remove } = useDictionary();
    const dictionaryEntries = Object.entries(dict);

    const handleAdd = () => {
        const cleanOriginal = original.trim();
        const cleanTranslated = translated.trim();

        if (!cleanOriginal || !cleanTranslated) return;

        add(cleanOriginal, cleanTranslated);
        setOriginal("");
        setTranslated("");
    };

    return (
        <section style={{ marginTop: 16 }}>
            <Forms.FormTitle>Diccionario personalizado ({dictionaryEntries.length})</Forms.FormTitle>
            <Forms.FormText>
                Traducciones preferidas para palabras y nombres.
            </Forms.FormText>

            <Divider style={{ marginTop: "16px", marginBottom: "16px" }} />

            <div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
                    <div style={{ flex: "1 1 150px" }}>
                        <TextInput
                            placeholder="Palabra original (p. ej. ナイト)"
                            value={original}
                            onChange={setOriginal}
                        />
                    </div>
                    <div style={{ flex: "0 0 auto", color: "var(--text-muted)" }}>→</div>
                    <div style={{ flex: "1 1 150px" }}>
                        <TextInput
                            placeholder="Traducción (p. ej. Knight)"
                            value={translated}
                            onChange={setTranslated}
                        />
                    </div>
                    <Button
                        onClick={handleAdd}
                        disabled={!original.trim() || !translated.trim()}
                        color={Button.Colors.GREEN}
                    >
                        Añadir
                    </Button>
                </div>

                {dictionaryEntries.length === 0 ? (
                    <Forms.FormText>
                        Tu diccionario personalizado está vacío.
                    </Forms.FormText>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto", paddingRight: "8px" }}>
                        {dictionaryEntries.map(([orig, trans]) => (
                            <div key={orig} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: "var(--background-secondary)", borderRadius: "6px" }}>
                                <div
                                    style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", cursor: "pointer" }}
                                    onClick={() => {
                                        setOriginal(orig);
                                        setTranslated(trans);
                                    }}
                                    title="Clic para editar"
                                >
                                    <span style={{ fontWeight: 600, color: "var(--header-primary)" }}>{orig}</span>
                                    <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>→</span>
                                    <span style={{ color: "var(--text-normal)" }}>{trans}</span>
                                </div>
                                <Button
                                    color={Button.Colors.RED}
                                    onClick={() => remove(orig)}
                                    size={Button.Sizes.SMALL}
                                    look={Button.Looks.FILLED}
                                >
                                    Quitar
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

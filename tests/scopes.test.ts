/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { isSameLanguage } from "../api/google";
import { applyScopeLayers, channelToScope, glossarySignature, type ResolvedConfigBase } from "../utils/scopesPure";
import { sanitizeTranslation } from "../utils/string";

function base(): ResolvedConfigBase {
    return {
        enabled: true,
        targetLang: "es",
        sourceLang: "auto",
        outgoingLang: "auto",
        engine: "google",
        outgoing: true,
        aiPrompt: "",
        outgoingPrompt: "",
        glossary: { gg: "buena partida" },
    };
}

test("precedence: user beats channel beats server", () => {
    const resolved = applyScopeLayers(base(), [
        ["guild", { enabled: true, targetLang: "es", engine: "google" }],
        ["channel", { enabled: false, targetLang: "en" }],
        ["user", { enabled: true, targetLang: "ja" }],
    ]);

    assert.equal(resolved.enabled, true);
    assert.equal(resolved.targetLang, "ja");
    assert.equal(resolved.engine, "google");
    assert.equal(resolved.scope, "user");
});

test("undefined keys inherit from the parent scope", () => {
    const resolved = applyScopeLayers(base(), [
        ["guild", { engine: "deepl" }],
        ["channel", { outgoing: false }],
        ["user", { targetLang: "fr" }],
    ]);

    assert.equal(resolved.engine, "deepl");
    assert.equal(resolved.outgoing, false);
    assert.equal(resolved.targetLang, "fr");
    assert.equal(resolved.sourceLang, "auto");
});

test("glossary merges global, server, channel and user", () => {
    const resolved = applyScopeLayers(base(), [
        ["guild", { glossary: { gg: "gg del server", wp: "bien jugado" } }],
        ["channel", { glossary: { wp: "wp del canal" } }],
        ["user", { glossary: { lol: "jaja" } }],
    ]);

    assert.deepEqual(resolved.glossary, {
        gg: "gg del server",
        wp: "wp del canal",
        lol: "jaja",
    });
});

test("engine disable forces enabled off", () => {
    const resolved = applyScopeLayers(base(), [["channel", { engine: "disable", enabled: true }]]);
    assert.equal(resolved.enabled, false);
});

test("whitelist channels are enabled unless explicitly disabled", () => {
    assert.equal(channelToScope({ id: "1", lang: "auto" }, "whitelist").enabled, true);
    assert.equal(channelToScope({ id: "1", enabled: false }, "whitelist").enabled, false);
    assert.equal(channelToScope({ id: "1", enabled: true }, "global").enabled, true);
});

test("auto source language inherits from the server scope", () => {
    assert.equal(channelToScope({ id: "1", lang: "auto" }, "global").sourceLang, undefined);
    assert.equal(channelToScope({ id: "1", lang: "en" }, "global").sourceLang, "en");
});

test("sanitizeTranslation removes AI punctuation not present in the source", () => {
    assert.equal(sanitizeTranslation("hola — mundo", "hello world"), "hola, mundo");
    assert.equal(sanitizeTranslation("“hola”…", "\"hello\""), "\"hola\"...");
    assert.equal(sanitizeTranslation("hola\u00A0mundo", "hello world"), "hola mundo");
});

test("sanitizeTranslation keeps punctuation the source already had", () => {
    assert.equal(sanitizeTranslation("hola — mundo", "hello — world"), "hola — mundo");
    assert.equal(sanitizeTranslation("“hola”", "“hello”"), "“hola”");
});

test("glossary signature is stable regardless of insertion order", () => {
    assert.equal(
        glossarySignature({ b: "2", a: "1" }),
        glossarySignature({ a: "1", b: "2" })
    );
    assert.notEqual(glossarySignature({ a: "1" }), glossarySignature({ a: "2" }));
});

test("isSameLanguage compares regions properly", () => {
    assert.equal(isSameLanguage("en", "en-US"), true);
    assert.equal(isSameLanguage("es", "es"), true);
    assert.equal(isSameLanguage("zh-CN", "zh-TW"), false);
    assert.equal(isSameLanguage("en", "es"), false);
});

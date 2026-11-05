/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { isSameLanguage } from "../api/google";
import { applyScopeLayers, channelToScope, type ResolvedConfigBase } from "../utils/scopesPure";

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
        ["guild", { engine: "deepseek" }],
        ["channel", { outgoing: false }],
        ["user", { targetLang: "fr" }],
    ]);

    assert.equal(resolved.engine, "deepseek");
    assert.equal(resolved.outgoing, false);
    assert.equal(resolved.targetLang, "fr");
    assert.equal(resolved.sourceLang, "auto");
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

test("isSameLanguage compares regions properly", () => {
    assert.equal(isSameLanguage("en", "en-US"), true);
    assert.equal(isSameLanguage("es", "es"), true);
    assert.equal(isSameLanguage("zh-CN", "zh-TW"), false);
    assert.equal(isSameLanguage("en", "es"), false);
});

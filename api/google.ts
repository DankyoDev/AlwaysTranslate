/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Free Google Translate endpoint, the same one Vencord's built-in Translate plugin uses.
 * No API key required.
 */

interface GoogleTranslateResponse {
    translation?: string;
    sourceLanguage?: string;
}

export interface GoogleTranslation {
    text: string;
    sourceLanguage: string;
}

const GOOGLE_ENDPOINT = "https://translate-pa.googleapis.com/v1/translate";
const GOOGLE_PUBLIC_KEY = "AIzaSyDLEeFI5OtFBwYBIoK_jj5m32rZK5CkCXA";

const RATE_LIMIT_COOLDOWN_MS = 60_000;
let cooldownUntil = 0;

export function getGoogleCooldownRemaining(): number {
    return Math.max(0, cooldownUntil - Date.now());
}

export function isSameLanguage(a: string | undefined, b: string | undefined): boolean {
    if (!a || !b) return false;

    const normalize = (value: string) => value.toLowerCase().replace("_", "-");
    const left = normalize(a);
    const right = normalize(b);

    if (left === right) return true;

    // en == en-us, but zh-cn != zh-tw
    return left.split("-")[0] === right.split("-")[0]
        && (!left.includes("-") || !right.includes("-"));
}

export async function googleTranslate(text: string, sourceLang: string, targetLang: string): Promise<GoogleTranslation> {
    const trimmed = text.trim();
    if (!trimmed) return { text: "", sourceLanguage: "" };

    if (getGoogleCooldownRemaining() > 0) {
        throw new Error("Google Translate is rate limited. Retrying soon.");
    }

    const url = GOOGLE_ENDPOINT + "?" + new URLSearchParams({
        "params.client": "gtx",
        "dataTypes": "TRANSLATION",
        "key": GOOGLE_PUBLIC_KEY,
        "query.sourceLanguage": sourceLang || "auto",
        "query.targetLanguage": targetLang,
        "query.text": trimmed,
    });

    const res = await fetch(url);

    if (res.status === 429) {
        cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        throw new Error("Google Translate rate limit reached");
    }

    if (!res.ok) {
        throw new Error(`Google Translate failed (${res.status} ${res.statusText})`);
    }

    const data = await res.json() as GoogleTranslateResponse;

    return {
        text: data.translation?.trim() ?? "",
        sourceLanguage: data.sourceLanguage ?? "",
    };
}

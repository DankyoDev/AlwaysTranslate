/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app,IpcMainInvokeEvent,safeStorage,shell } from "electron";
import fs from "fs/promises";
import path from "path";

import { TRANSLATION_TIMEOUT_MS } from "./api/errors";
import { CACHE_PERSISTENT_MAX_SIZE } from "./constants";
import { CACHE_BYTE_BUDGET, CACHE_ENTRY_BYTE_LIMIT, CACHE_PATCH_ENTRY_LIMIT, cacheEntryBytes, type CachePatch } from "./utils/cachePolicy";

const requests = new Map<string, AbortController>();

// ─── Debug log file ───
// Only written when the "Debug log" setting is enabled; the renderer decides.
const LOG_FILE = () => path.join(app.getPath("userData"), "AlwaysTranslate.log");
const MAX_LOG_SIZE = 5 * 1024 * 1024;

async function fileSize(file: string) {
    try {
        return (await fs.stat(file)).size;
    } catch {
        return 0;
    }
}

export async function batLogAppend(_: IpcMainInvokeEvent, text: string): Promise<boolean> {
    try {
        const file = LOG_FILE();

        // Rotate once the file gets too big
        if (await fileSize(file) > MAX_LOG_SIZE) {
            const rotated = `${file}.1`;
            await fs.rm(rotated, { force: true });
            await fs.rename(file, rotated).catch(() => { });
        }

        await fs.appendFile(file, text, "utf-8");
        return true;
    } catch (e) {
        console.error("[AlwaysTranslate] Failed to write debug log", e);
        return false;
    }
}

export async function batLogClear(): Promise<boolean> {
    try {
        await fs.writeFile(LOG_FILE(), "", "utf-8");
        return true;
    } catch (e) {
        console.error("[AlwaysTranslate] Failed to clear debug log", e);
        return false;
    }
}

export async function batLogOpen(): Promise<string> {
    return shell.openPath(LOG_FILE());
}

export async function batLogPath(): Promise<string> {
    return LOG_FILE();
}

// ─── Encrypted secret storage (API keys) ───
// Values are encrypted with the OS keychain (DPAPI on Windows) through Electron's safeStorage.
const SECRETS_FILE = () => path.join(app.getPath("userData"), "AlwaysTranslateSecrets.json");

async function readSecrets(): Promise<Record<string, string>> {
    try {
        return JSON.parse(await fs.readFile(SECRETS_FILE(), "utf-8"));
    } catch {
        return {};
    }
}

async function writeSecrets(data: Record<string, string>) {
    const file = SECRETS_FILE();
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 4), "utf-8");
    await fs.rename(tmp, file);
}

export function batSecretAvailable() {
    try {
        return safeStorage.isEncryptionAvailable();
    } catch {
        return false;
    }
}

export async function batSecretGet(_: IpcMainInvokeEvent, name: string): Promise<string> {
    if (!batSecretAvailable()) return "";

    try {
        const data = await readSecrets();
        const encoded = data[name];
        if (!encoded) return "";

        return safeStorage.decryptString(Buffer.from(encoded, "base64"));
    } catch (e) {
        console.error("[AlwaysTranslate] Failed to read secret", name, e);
        return "";
    }
}

export async function batSecretSet(_: IpcMainInvokeEvent, name: string, value: string): Promise<boolean> {
    if (!batSecretAvailable()) return false;

    try {
        const data = await readSecrets();

        if (!value) delete data[name];
        else data[name] = safeStorage.encryptString(value).toString("base64");

        await writeSecrets(data);
        return true;
    } catch (e) {
        console.error("[AlwaysTranslate] Failed to store secret", name, e);
        return false;
    }
}

async function translationFetch(event: IpcMainInvokeEvent, requestId: string, url: string, init: RequestInit, timeout: number) {
    const key = event.sender.id + ":" + requestId;
    const controller = new AbortController();
    requests.set(key, controller);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, Math.min(timeout, TRANSLATION_TIMEOUT_MS));
    try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        return { ok: res.ok, status: res.status, data: await res.text(), retryAfter: res.headers?.get("retry-after") ?? null };
    } catch (e) {
        return { ok: false, status: -1, data: timedOut ? "Translation timed out (60s)" : controller.signal.aborted ? "Translation cancelled" : "Network connection failed", retryAfter: null };
    } finally {
        clearTimeout(timer);
        requests.delete(key);
    }
}

export async function batCancelRequest(event: IpcMainInvokeEvent, requestId: string) {
    requests.get(event.sender.id + ":" + requestId)?.abort();
}

export async function batGeminiFetch(event: IpcMainInvokeEvent, apiUrl: string, apiKey: string, payload: string, requestId: string) {
    return translationFetch(event, requestId, `${apiUrl}?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: payload
        }, 300000);
}

export async function batDeepSeekFetch(event: IpcMainInvokeEvent, apiUrl: string, apiKey: string, payload: string, requestId: string) {
    return translationFetch(event, requestId, apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: payload
        }, 300000);
}

export async function batDeepSeekBalanceFetch(_: IpcMainInvokeEvent, apiKey: string) {
    try {
        const res = await fetch("https://api.deepseek.com/user/balance", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Accept": "application/json"
            }
        });

        const text = await res.text();
        return { ok: res.ok, status: res.status, data: text };
    } catch (e) {
        return { ok: false, status: -1, data: String(e) };
    }
}

let cacheState: Promise<Map<string, { value: string; bytes: number }>> | null = null;
let cacheWrite: Promise<unknown> = Promise.resolve();

function trimCache(entries: Map<string, { value: string; bytes: number }>) {
    let bytes = 0;
    for (const entry of entries.values()) bytes += entry.bytes;
    while (entries.size > CACHE_PERSISTENT_MAX_SIZE || bytes > CACHE_BYTE_BUDGET) {
        const key = entries.keys().next().value!; bytes -= entries.get(key)!.bytes; entries.delete(key);
    }
}

function loadCacheState() {
    return cacheState ??= (async () => {
        const entries = new Map<string, { value: string; bytes: number }>();
        try {
            const parsed = JSON.parse(await fs.readFile(path.join(app.getPath("userData"), "AlwaysTranslateCache.json"), "utf-8"));
            if (parsed?.version === 3 && parsed.entries && typeof parsed.entries === "object") {
                for (const [key, value] of Object.entries(parsed.entries)) {
                    if (!key.startsWith("v3:") || typeof value !== "string") continue;
                    const bytes = cacheEntryBytes(key, value);
                    if (bytes <= CACHE_ENTRY_BYTE_LIMIT) entries.set(key, { value, bytes });
                }
                trimCache(entries);
            }
        } catch {}
        return entries;
    })();
}

function cacheSnapshot(entries: Map<string, { value: string; bytes: number }>) {
    return JSON.stringify({ version: 3, entries: Object.fromEntries(Array.from(entries, ([key, entry]) => [key, entry.value])) });
}

export async function batCacheLoad(_: IpcMainInvokeEvent): Promise<string> {
    await cacheWrite;
    return cacheSnapshot(await loadCacheState());
}

export function batCacheSave(_: IpcMainInvokeEvent, patch: CachePatch): Promise<boolean> {
    const operation = cacheWrite.then(async () => {
        if (patch?.version !== 3 || !Array.isArray(patch.entries) || patch.entries.length > CACHE_PATCH_ENTRY_LIMIT ||
            !patch.entries.every(([key, value]) => typeof key === "string" && key.startsWith("v3:") &&
                (value === null || (typeof value === "string" && cacheEntryBytes(key, value) <= CACHE_ENTRY_BYTE_LIMIT)))) {
            throw new Error("Invalid cache patch");
        }
        const entries = await loadCacheState();
        if (patch.clear) entries.clear();
        for (const [key, value] of patch.entries) {
            entries.delete(key);
            if (value !== null) entries.set(key, { value, bytes: cacheEntryBytes(key, value) });
        }
        if (patch.persist) {
            trimCache(entries);
            const destination = path.join(app.getPath("userData"), "AlwaysTranslateCache.json");
            const temporary = destination + ".tmp";
            try {
                await fs.writeFile(temporary, cacheSnapshot(entries), "utf-8");
                await fs.rename(temporary, destination);
            } catch (error) {
                await fs.unlink(temporary).catch(() => {});
                throw error;
            }
        }
        return true;
    }).catch(error => { console.error("[AlwaysTranslate] Failed to save cache:", error); return false; });
    cacheWrite = operation;
    return operation;
}

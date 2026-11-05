/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { settings } from "../settings";

const PREFIX = "[AlwaysTranslate]";

let buffer: string[] = [];
let flushTimer: number | null = null;
let flushing = false;

function nativeLogger(): any {
    try {
        return VencordNative.pluginHelpers.AlwaysTranslate;
    } catch {
        return undefined;
    }
}

/** Debug logging only writes to the log file when the setting is enabled. */
export function isDebugEnabled(): boolean {
    try {
        return !!settings.store.debugLog;
    } catch {
        return false;
    }
}

export function preview(value: string, max = 160): string {
    const clean = value.replace(/\s+/g, " ").trim();
    return clean.length > max ? `${clean.slice(0, max)}…(${clean.length} chars)` : clean;
}

function formatValue(value: unknown): string {
    if (value instanceof Error) return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`;
    if (typeof value === "string") return value;
    if (value === undefined) return "undefined";

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function scheduleFlush() {
    if (flushTimer !== null) return;

    flushTimer = window.setTimeout(() => {
        flushTimer = null;
        flush();
    }, 400);
}

function flush() {
    if (flushing || !buffer.length) return;

    const chunk = buffer.join("");
    buffer = [];

    const native = nativeLogger();
    if (typeof native?.batLogAppend !== "function") return;

    flushing = true;
    Promise.resolve(native.batLogAppend(chunk))
        .catch(() => { })
        .finally(() => { flushing = false; });
}

function write(level: "DEBUG" | "INFO" | "WARN" | "ERROR", context: string, message: string, args: unknown[]) {
    if (!isDebugEnabled()) return;

    const line = `${new Date().toISOString()} [${level}] [${context}] ${message}`
        + (args.length ? " | " + args.map(formatValue).join(" | ") : "")
        + "\n";

    buffer.push(line);

    // Never let the buffer grow unbounded if the native side is unavailable
    if (buffer.length > 500) flush();
    else scheduleFlush();
}

export function initDebugLog() {
    if (!isDebugEnabled()) return;

    buffer.push(`\n===== AlwaysTranslate debug session started ${new Date().toISOString()} =====\n`);
    flush();

    window.addEventListener("beforeunload", flush);
}

export const Logger = {
    debug(context: string, message: string, ...args: unknown[]) {
        if (!isDebugEnabled()) return;

        console.debug(`${PREFIX} [${context}]`, message, ...args);
        write("DEBUG", context, message, args);
    },

    info(context: string, message: string, ...args: unknown[]) {
        console.log(`${PREFIX} [${context}]`, message, ...args);
        write("INFO", context, message, args);
    },

    warn(context: string, message: string, ...args: unknown[]) {
        console.warn(`${PREFIX} [${context}]`, message, ...args);
        write("WARN", context, message, args);
    },

    error(context: string, message: string, ...args: unknown[]) {
        console.error(`${PREFIX} [${context}]`, message, ...args);
        write("ERROR", context, message, args);
    },
};

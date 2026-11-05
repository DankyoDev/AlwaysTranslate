/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LANGUAGES } from "../constants";

function getLanguageName(code: string): string {
    const lang = LANGUAGES.find(l => l.value === code);
    return lang ? lang.label : code;
}

function contextRules(): string {
    return `# Context
- Text inside <context> is background only. NEVER translate it and never copy its wording.
- A line marked "(replying to X)" answers X: use it to resolve pronouns, references and short replies.
- Consecutive messages from the same author are their ongoing thread; keep continuity with them.
- Names are shown as "name: text". Use them to tell participants apart.`;
}

function outputRules(): string {
    return `# Output
- Return ONLY the translations, no explanations, no notes, no markdown fences.
- Preserve every "id" exactly.`;
}

function styleRules(): string {
    return `# Style
- Keep the exact meaning, tone and formatting of the original.
- Write like a native speaker of the target language, not like a translator.
- Do NOT introduce em dashes (—), en dashes (–), curly quotes (“ ” ‘ ’) or ellipses (…) that are not in the original. Use the same punctuation the source used.
- Do not add words, emphasis, emojis or punctuation that are not in the original.
- Never change placeholders like [token0] or Discord syntax (<@id>, <#id>, emojis, markdown, URLs, code).`;
}

export function buildBatchTranslationPrompt(targetLang: string, customPrompt: string, hasContext = false): string {
    const langName = getLanguageName(targetLang);
    return `You are a translation engine. Translate every message into ${langName}.

${styleRules()}
${hasContext ? `\n${contextRules()}\n` : ""}
${outputRules()}
- Use this schema: [{"id":"string","text":"translated_string"}]
${customPrompt ? `\nExtra instruction: ${customPrompt}` : ""}`;
}

export function buildBatchUserPromptContext(messagesToTranslate: { id: string, text: string }[], context?: string): string {
    return `${context ? `<context>\n${context}\n</context>\n\n` : ""}<target_messages>
${JSON.stringify(messagesToTranslate)}
</target_messages>`;
}


// --- DeepSeek Specific Prompts (For Context Caching) ---

export function buildDeepSeekSystemPrompt(): string {
    return `You are a translation engine for Discord chat.

${styleRules()}

# Context
- Text inside <context> is background only. NEVER translate it.
- "(replying to X)" means that message answers X: use it to resolve pronouns and references.
- Consecutive messages from the same author are their ongoing thread.
- Use the participant names to tell people apart.

${outputRules()}
- Use this exact schema: {"id_string":"translated_string"}`;
}

export function buildDeepSeekUserPrompt(targetLang: string, customPrompt: string, messagesToTranslate: { id: string, text: string }[], context?: string): string {
    const langName = getLanguageName(targetLang);
    const compactInput = Object.fromEntries(messagesToTranslate.map(m => [m.id, m.text]));
    return `Translate to ${langName}.
${customPrompt ? `Extra instruction: ${customPrompt}\n` : ""}${context ? `<context>\n${context}\n</context>\n` : ""}<target_messages>
${JSON.stringify(compactInput)}
</target_messages>`;
}

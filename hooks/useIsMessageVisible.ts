/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState } from "@webpack/common";

const ROOT_MARGIN = "400px 0px";

/**
 * Whether a message is close to the viewport.
 * Used to translate lazily instead of spending API calls on the whole channel.
 */
export function useIsMessageVisible(messageId: string): boolean {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!messageId) return;

        let observer: IntersectionObserver | undefined;
        let retry: number | undefined;
        let attempts = 0;
        let cancelled = false;

        const attach = () => {
            if (cancelled) return;

            const node = document.getElementById(`message-content-${messageId}`);
            if (!node) {
                // Give Discord a few seconds to mount the node, then give up
                if (attempts++ < 24) retry = window.setTimeout(attach, 250);
                return;
            }

            observer = new IntersectionObserver(entries => {
                if (entries.some(entry => entry.isIntersecting)) {
                    setVisible(true);
                    observer?.disconnect();
                }
            }, { rootMargin: ROOT_MARGIN });

            observer.observe(node);
        };

        attach();

        return () => {
            cancelled = true;
            if (retry) clearTimeout(retry);
            observer?.disconnect();
        };
    }, [messageId]);

    return visible;
}

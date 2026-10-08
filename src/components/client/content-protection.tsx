"use client";

import { useEffect, useMemo } from "react";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A faint, repeating, slanted tile with the client's own name — any leaked screenshot shows whose account it came from. */
function watermark(name: string) {
  const text = `${esc(name.trim().slice(0, 40))} · كابتن أيمن`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="190">` +
    `<g fill="#808080" fill-opacity="0.1" font-family="system-ui,-apple-system,Segoe UI,Tahoma,sans-serif" font-size="13" font-weight="600" text-anchor="middle">` +
    `<text x="150" y="60" transform="rotate(-22 150 60)">${text}</text>` +
    `<text x="0" y="155" transform="rotate(-22 0 155)">${text}</text>` +
    `<text x="300" y="155" transform="rotate(-22 300 155)">${text}</text>` +
    `</g></svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}

/**
 * Client area only: makes it harder to copy content or capture it.
 * • a faint watermark with the client's name over every page (photos included)
 * • no text selection / copy / cut outside form fields
 * • no long-press "save image" menu, right-click menu or dragging images out
 * • content is hidden while the app is in the background (so the app switcher preview is blank)
 * • computers: content is hidden while the screenshot shortcuts are pressed (Win+Shift+S, ⌘⇧3/4/5),
 *   when the window loses focus (e.g. the snipping tool opens), and Print Screen wipes the clipboard
 * • nothing prints
 * Browsers don't let websites block the phone's own screenshot buttons — see docs/HANDOVER.ar.md.
 */
export function ContentProtection({ name }: { name: string }) {
  const mark = useMemo(() => watermark(name), [name]);

  useEffect(() => {
    const editable = (t: EventTarget | null) => t instanceof Element && !!t.closest("input, textarea, select, [contenteditable='true']");
    const block = (e: Event) => {
      if (!editable(e.target)) e.preventDefault();
    };
    const noDrag = (e: DragEvent) => {
      if (e.target instanceof HTMLImageElement) e.preventDefault();
    };
    const root = document.documentElement;
    root.dataset.protect = "on"; // CSS hooks (also reach dialogs, which render outside the layout)

    let timer: number | undefined;
    const hide = (ms?: number) => {
      root.dataset.privacy = "on";
      window.clearTimeout(timer);
      if (ms) timer = window.setTimeout(() => document.visibilityState === "visible" && document.hasFocus() && show(), ms);
    };
    const show = () => {
      window.clearTimeout(timer);
      delete root.dataset.privacy;
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? hide() : show());

    // Desktop only — on phones the window "blurs" for ordinary things (pickers, keyboards) and these keys don't exist.
    const desktop = window.matchMedia("(pointer: fine)").matches;
    const shortcut = (e: KeyboardEvent) => (e.metaKey && e.shiftKey) || (e.key === "Meta" && e.shiftKey) || (e.key === "Shift" && e.metaKey);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") hide(1500);
      else if (shortcut(e)) hide(5000);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "PrintScreen") return;
      hide(1500);
      navigator.clipboard?.writeText("").catch(() => {}); // the key already copied the screen — overwrite it
    };
    const onBlur = () => {
      if (document.activeElement?.tagName !== "IFRAME") hide();
    };

    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", noDrag);
    document.addEventListener("visibilitychange", onVisibility);
    if (desktop) {
      window.addEventListener("keydown", onKeyDown, true);
      window.addEventListener("keyup", onKeyUp, true);
      window.addEventListener("blur", onBlur);
      window.addEventListener("focus", show);
      window.addEventListener("pointerdown", show, true);
    }
    return () => {
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", noDrag);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", show);
      window.removeEventListener("pointerdown", show, true);
      window.clearTimeout(timer);
      delete root.dataset.privacy;
      delete root.dataset.protect;
    };
  }, []);

  return <div aria-hidden className="ca-watermark" style={{ backgroundImage: mark }} />;
}

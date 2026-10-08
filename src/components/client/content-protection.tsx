"use client";

import { useEffect } from "react";

/**
 * Client area only: makes it harder to copy content or save photos.
 * • no text selection / copy / cut outside form fields
 * • no long-press "save image" menu, right-click menu or dragging images out
 * • content is hidden while the app is in the background (so the app switcher preview is blank)
 * • nothing prints
 * Browsers don't let websites block the phone's own screenshot button — see docs/HANDOVER.ar.md.
 */
export function ContentProtection() {
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
    const onVisibility = () => {
      if (document.visibilityState === "hidden") root.dataset.privacy = "on";
      else delete root.dataset.privacy;
    };
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", noDrag);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", noDrag);
      document.removeEventListener("visibilitychange", onVisibility);
      delete root.dataset.privacy;
      delete root.dataset.protect;
    };
  }, []);
  return null;
}

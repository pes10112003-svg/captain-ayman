"use client";

import { useEffect } from "react";
import { setChatCounts } from "./inbox";

/** After a chat is opened, the chat tab's badge drops to what is still unread. */
export function ChatReadSync({ group, coach }: { group: number; coach: number }) {
  useEffect(() => setChatCounts(group, coach), [group, coach]);
  return null;
}

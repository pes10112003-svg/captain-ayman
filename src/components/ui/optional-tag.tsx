"use client";

import { useI18n } from "@/i18n/client";

export function OptionalTag() {
  const { t } = useI18n();
  return <span className="ms-1 font-normal text-muted">({t.common.optional})</span>;
}

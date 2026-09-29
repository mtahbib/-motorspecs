"use client";

import type { ComponentProps } from "react";

/** A <select> that submits its form when changed (progressive enhancement). */
export function AutoSubmitSelect(props: ComponentProps<"select">) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}

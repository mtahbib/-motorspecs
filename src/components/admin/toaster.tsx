"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

/** Shows a short confirmation for completed staff actions (see ActionForm). */
export function Toaster() {
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onToast = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      setToast({ id: Date.now(), text });
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 4500);
    };
    window.addEventListener("ms:toast", onToast);
    return () => {
      window.removeEventListener("ms:toast", onToast);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      {toast && (
        <div key={toast.id} role="status" className="pointer-events-auto flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-2xl">
          <CheckCircle2 className="size-4 text-[#5ee2a0]" aria-hidden /> {toast.text}
        </div>
      )}
    </div>
  );
}

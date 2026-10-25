"use client";
import { useEffect } from "react";
import { useMe } from "@/hooks/use-me";
import { useRealtime } from "@/hooks/use-realtime";
import { useUi } from "@/stores/ui";
import { CommandPalette } from "./command-palette";
import { ContactDrawer } from "@/components/contacts/contact-drawer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: me } = useMe();
  useRealtime(!!me);
  const setCommandOpen = useUi((s) => s.setCommandOpen);
  const contactId = useUi((s) => s.contactDrawerId);
  const openContact = useUi((s) => s.openContact);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen]);

  return (
    <>
      {children}
      <CommandPalette />
      <ContactDrawer contactId={contactId} onClose={() => openContact(null)} />
    </>
  );
}

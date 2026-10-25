import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hexToRgbTriplet } from "@/lib/utils";
import { Topbar } from "@/components/layout/topbar";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Tema White-Label do tenant (cores da agência)
  const css = `:root{--primary:${hexToRgbTriplet(session.agency.primaryColor)};--secondary:${hexToRgbTriplet(session.agency.secondaryColor)};}`;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <AppShell>
        <Topbar />
        <main className="min-h-app">{children}</main>
      </AppShell>
    </>
  );
}

import { TiempoReal } from "@/components/tiempo-real";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="canvas flex min-h-full flex-1 flex-col">
      {/* La campana se entera sola: el servidor avisa por un canal abierto. */}
      <TiempoReal />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

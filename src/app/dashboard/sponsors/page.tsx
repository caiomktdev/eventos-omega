import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { PlatformSponsorManager } from "@/components/admin/platform-sponsor-manager";
import { PlatformBannerManager } from "@/components/admin/platform-banner-manager";

export const metadata: Metadata = {
  title: "Patrocinadores — EventosOmega",
};

export default async function DashboardSponsorsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/admin/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Patrocinadores</h1>
        <p className="mt-1 text-muted-foreground">
          Gerencie as logos do carrossel e as mídias do banner promocional exibidos na página inicial.
        </p>
      </div>

      <div className="space-y-8">
        <PlatformSponsorManager />
        <PlatformBannerManager />
      </div>
    </div>
  );
}

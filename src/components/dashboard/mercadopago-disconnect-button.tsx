"use client";

/**
 * Botão para desconectar conta Mercado Pago (POST /api/mercadopago/disconnect).
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Unlink } from "lucide-react";

import { Button } from "@/components/ui/button";

export function MercadoPagoDisconnectButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDisconnect() {
    setLoading(true);
    try {
      const res = await fetch("/api/mercadopago/disconnect", { method: "POST" });
      if (!res.ok) {
        throw new Error("Falha ao desconectar.");
      }
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleDisconnect}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Unlink className="h-3.5 w-3.5" />
      )}
      Desconectar
    </Button>
  );
}

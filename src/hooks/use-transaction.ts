/**
 * Hook para exibir o estado de uma transação em tempo real via polling.
 * Útil na página pós-checkout enquanto o webhook do MP ainda não chegou.
 */

"use client";

import { useState, useEffect, useRef } from "react";

export type TransactionStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "REFUNDED"
  | "IN_PROCESS"
  | "IN_MEDIATION"
  | "CHARGED_BACK";

export interface TransactionSummary {
  id: string;
  status: TransactionStatus;
  grossValue: number;
  mooveFee: number;
  organizerNetValue: number;
  paidAt: string | null;
}

interface UseTransactionOptions {
  /** Intervalo de polling em ms. 0 = desativado. Default: 3000 */
  pollInterval?: number;
  /** Para de fazer polling quando o status for final */
  stopOnFinalStatus?: boolean;
}

const FINAL_STATUSES: TransactionStatus[] = [
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "REFUNDED",
  "CHARGED_BACK",
];

export function useTransaction(
  participantId: string | null,
  options: UseTransactionOptions = {}
) {
  const { pollInterval = 3000, stopOnFinalStatus = true } = options;

  const [transaction, setTransaction] = useState<TransactionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchTransaction() {
    if (!participantId) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/participants/${participantId}/transaction`);
      if (!res.ok) throw new Error("Transação não encontrada.");
      const data: TransactionSummary = await res.json();
      setTransaction(data);

      if (
        stopOnFinalStatus &&
        FINAL_STATUSES.includes(data.status) &&
        intervalRef.current
      ) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!participantId) return;

    fetchTransaction();

    if (pollInterval > 0) {
      intervalRef.current = setInterval(fetchTransaction, pollInterval);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId, pollInterval]);

  return { transaction, isLoading, error, refetch: fetchTransaction };
}

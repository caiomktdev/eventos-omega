/**
 * Tipos TypeScript compartilhados entre client e server.
 * Re-exporta tipos do Prisma e define tipos compostos para a UI.
 */

import type {
  Event,
  TicketType,
  Participant,
  Transaction,
  User,
  EventStatus,
  ParticipantStatus,
  TransactionStatus,
} from "@prisma/client";

// Re-exporta os enums do Prisma para uso no frontend
export type { EventStatus, ParticipantStatus, TransactionStatus };

// Evento com tipos de ingresso e organizador
export type EventWithDetails = Event & {
  organizer: Pick<User, "id" | "name" | "image">;
  ticketTypes: TicketType[];
  _count?: { participants: number };
};

// Evento com o formStructure tipado (em vez de Json genérico do Prisma)
export interface FormField {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "number" | "select" | "checkbox" | "textarea" | "url";
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface EventFormStructure {
  fields: FormField[];
}

// Participante completo com evento e transação
export type ParticipantWithDetails = Participant & {
  user: Pick<User, "id" | "name" | "email" | "image">;
  event: Pick<Event, "id" | "title" | "startDate" | "venue" | "coverImage">;
  ticketType: Pick<TicketType, "id" | "name" | "price">;
  transaction: Transaction | null;
};

// Resumo de ingresso selecionado para o checkout
export interface TicketSelection {
  ticketTypeId: string;
  ticketTypeName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

// Resumo financeiro calculado no servidor para exibição no checkout
export interface CheckoutSummary {
  items: TicketSelection[];
  grossValue: number;
  mooveFee: number;
  organizerNetValue: number;
  feeRateApplied: number;
}

// Resposta da API ao criar preferência de pagamento MP
export interface CheckoutPreferenceResponse {
  preferenceId: string;
  initPoint: string;
  participantId: string;
}

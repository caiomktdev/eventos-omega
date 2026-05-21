/**
 * Schemas Zod para validação de entradas nas API Routes.
 */

import { z } from "zod";

export const createEventSchema = z.object({
  title: z.string().min(3, "Título deve ter ao menos 3 caracteres").max(120),
  description: z.string().min(10, "Descrição muito curta").max(5000),
  coverImage: z.string().url("URL inválida").optional().or(z.literal("")),
  venue: z.string().min(2).max(100),
  address: z.string().min(5).max(200),
  city: z.string().min(2).max(80),
  state: z.string().length(2, "Use a sigla do estado (ex: SP)"),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  ticketTypes: z
    .array(
      z.object({
        name: z.string().min(2).max(80),
        description: z.string().optional(),
        price: z.number().min(0, "Preço não pode ser negativo"),
        totalQuantity: z.number().int().positive("Quantidade deve ser positiva"),
        maxPerOrder: z.number().int().min(1).max(100).default(10),
        salesStartDate: z.string().datetime().optional(),
        salesEndDate: z.string().datetime().optional(),
      })
    )
    .min(1, "Adicione ao menos um tipo de ingresso"),
});

export const enrollSchema = z.object({
  eventId: z.string().cuid("ID do evento inválido."),
  ticketTypeId: z.string().cuid("ID do tipo de ingresso inválido."),
  formData: z.object({
    nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres.").max(120),
    email: z.string().email("E-mail inválido."),
  }).catchall(z.union([z.string(), z.boolean(), z.number()])),
});

export const webhookSchema = z.object({
  action: z.string(),
  type: z.string(),
  data: z.object({
    id: z.string(),
  }),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type EnrollInput = z.infer<typeof enrollSchema>;

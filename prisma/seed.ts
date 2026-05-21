/**
 * Seed de desenvolvimento: cria usuários (admin + organizador) e eventos de exemplo.
 * Execute com: npm run db:seed
 *
 * Credenciais padrão (APENAS para desenvolvimento):
 *   Admin:       admin@eventosomega.com / Admin@2026!
 *   Organizer:   organizer@eventosomega.com / Org@2026!
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateSlug } from "../src/lib/utils";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed...");

  // Usuário admin
  const adminHash = await bcrypt.hash("Admin@2026!", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@eventosomega.com" },
    update: { password: adminHash },
    create: {
      name: "Administrador",
      email: "admin@eventosomega.com",
      role: "ADMIN",
      password: adminHash,
    },
  });
  console.log(`✅ Admin criado: ${admin.id} — admin@eventosomega.com / Admin@2026!`);

  // Organizador demo
  const orgHash = await bcrypt.hash("Org@2026!", 12);
  const organizer = await prisma.user.upsert({
    where: { email: "organizer@eventosomega.com" },
    update: { password: orgHash },
    create: {
      name: "Organizer Demo",
      email: "organizer@eventosomega.com",
      role: "ORGANIZER",
      password: orgHash,
    },
  });

  console.log(`✅ Organizador criado: ${organizer.id}`);
  console.log(
    `   → Adicione ao .env.local: DEMO_ORGANIZER_ID="${organizer.id}"`
  );

  // Evento 1 — Show de Rock
  const event1 = await prisma.event.upsert({
    where: { id: "seed-event-001" },
    update: {},
    create: {
      id: "seed-event-001",
      slug: generateSlug("Festival de Rock Omega 2026"),
      title: "Festival de Rock Omega 2026",
      description:
        "O maior festival de rock do Brasil está de volta! Três dias de muita música, arte e cultura. Com atrações nacionais e internacionais, o Festival de Rock Omega 2026 promete ser inesquecível.\n\nBandas confirmadas: The Rolling Sounds, Electric Storm, Nação Rock e muito mais.",
      coverImage: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1200&q=80",
      venue: "Parque Villa-Lobos",
      address: "Av. Professor Fonseca Rodrigues, 2001",
      city: "Viçosa",
      state: "MG",
      startDate: new Date("2026-07-15T18:00:00-03:00"),
      endDate: new Date("2026-07-17T23:00:00-03:00"),
      status: "PUBLISHED",
      organizerId: organizer.id,
      ticketTypes: {
        create: [
          {
            name: "Pista",
            description: "Acesso à área geral do festival",
            price: 150.0,
            totalQuantity: 5000,
            maxPerOrder: 4,
          },
          {
            name: "Pista Premium",
            description: "Área privilegiada com melhor visibilidade",
            price: 250.0,
            totalQuantity: 1000,
            maxPerOrder: 4,
          },
          {
            name: "VIP",
            description: "Open bar, camarote exclusivo e meet & greet",
            price: 500.0,
            totalQuantity: 200,
            maxPerOrder: 2,
          },
        ],
      },
    },
  });

  // Evento 2 — Conferência Tech
  const event2 = await prisma.event.upsert({
    where: { id: "seed-event-002" },
    update: {},
    create: {
      id: "seed-event-002",
      slug: generateSlug("OmegaConf Tech 2026"),
      title: "OmegaConf Tech 2026",
      // formStructure com campos extras — demonstra o formulário dinâmico
      formStructure: {
        fields: [
          {
            name: "empresa",
            label: "Empresa / Organização",
            type: "text",
            required: false,
            placeholder: "Ex: ACME Corp",
          },
          {
            name: "cargo",
            label: "Cargo",
            type: "text",
            required: false,
            placeholder: "Ex: Engenheiro de Software",
          },
          {
            name: "nivel",
            label: "Nível de Experiência",
            type: "select",
            required: true,
            options: ["Júnior", "Pleno", "Sênior", "Tech Lead", "Gestor"],
          },
          {
            name: "linkedin",
            label: "Perfil do LinkedIn",
            type: "url",
            required: false,
            placeholder: "https://linkedin.com/in/...",
          },
          {
            name: "termos",
            label: "Aceito receber comunicações do evento",
            type: "checkbox",
            required: false,
          },
        ],
      },
      description:
        "A principal conferência de tecnologia da América Latina. Palestras sobre IA, blockchain, cloud computing e o futuro do desenvolvimento de software.\n\nSpeakers de empresas como Google, Meta, AWS e startups inovadoras.",
      coverImage: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=80",
      venue: "Expo Center Norte",
      address: "Rua José Bernardo Pinto, 333",
      city: "Viçosa",
      state: "MG",
      startDate: new Date("2026-08-20T08:00:00-03:00"),
      endDate: new Date("2026-08-21T18:00:00-03:00"),
      status: "PUBLISHED",
      organizerId: organizer.id,
      ticketTypes: {
        create: [
          {
            name: "Early Bird",
            description: "Acesso completo aos 2 dias — oferta limitada",
            price: 299.0,
            totalQuantity: 200,
            maxPerOrder: 5,
          },
          {
            name: "Regular",
            description: "Acesso completo aos 2 dias",
            price: 499.0,
            totalQuantity: 1000,
            maxPerOrder: 5,
          },
          {
            name: "Workshop Pass",
            description: "Acesso aos workshops práticos + conferência",
            price: 799.0,
            totalQuantity: 100,
            maxPerOrder: 2,
          },
        ],
      },
    },
  });

  // Evento 3 — Gratuito
  const event3 = await prisma.event.upsert({
    where: { id: "seed-event-003" },
    update: {},
    create: {
      id: "seed-event-003",
      slug: generateSlug("Meetup de Desenvolvedores Omega"),
      title: "Meetup de Desenvolvedores Omega",
      description:
        "Encontro mensal da comunidade de desenvolvedores. Palestras rápidas (lightning talks), networking e muita troca de experiências. Entrada gratuita!",
      venue: "WeWork Vila Olímpia",
      address: "Rua Funchal, 411",
      city: "Viçosa",
      state: "MG",
      startDate: new Date("2026-06-25T19:00:00-03:00"),
      endDate: new Date("2026-06-25T22:00:00-03:00"),
      status: "PUBLISHED",
      organizerId: organizer.id,
      ticketTypes: {
        create: [
          {
            name: "Entrada Gratuita",
            description: "Inscrição necessária para controle de capacidade",
            price: 0.0,
            totalQuantity: 150,
            maxPerOrder: 2,
          },
        ],
      },
    },
  });

  console.log(`✅ Eventos criados: ${event1.id}, ${event2.id}, ${event3.id}`);

  // Patrocinadores globais (carrossel de logos na home)
  const sponsorSeeds = [
    {
      id: "seed-sponsor-001",
      name: "Moovehubb",
      logoUrl:
        "https://images.unsplash.com/photo-1611162617474-5b21e939e113?w=400&h=160&fit=crop&q=80",
      linkUrl: "https://www.instagram.com/moovehubb/",
      sortOrder: 0,
    },
    {
      id: "seed-sponsor-002",
      name: "Tech Partners",
      logoUrl:
        "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=400&h=160&fit=crop&q=80",
      linkUrl: "https://example.com",
      sortOrder: 1,
    },
    {
      id: "seed-sponsor-003",
      name: "Omega Labs",
      logoUrl:
        "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=160&fit=crop&q=80",
      linkUrl: null,
      sortOrder: 2,
    },
    {
      id: "seed-sponsor-004",
      name: "Eventos MG",
      logoUrl:
        "https://images.unsplash.com/photo-1511578314322-379afb476865?w=400&h=160&fit=crop&q=80",
      linkUrl: null,
      sortOrder: 3,
    },
  ] as const;

  for (const sponsor of sponsorSeeds) {
    await prisma.platformSponsor.upsert({
      where: { id: sponsor.id },
      update: {
        name: sponsor.name,
        logoUrl: sponsor.logoUrl,
        linkUrl: sponsor.linkUrl ?? null,
        sortOrder: sponsor.sortOrder,
        isActive: true,
      },
      create: {
        id: sponsor.id,
        name: sponsor.name,
        logoUrl: sponsor.logoUrl,
        linkUrl: sponsor.linkUrl ?? null,
        sortOrder: sponsor.sortOrder,
        isActive: true,
      },
    });
  }
  console.log(`✅ Patrocinadores criados: ${sponsorSeeds.length}`);

  // Banner promocional grande (slider na home)
  const bannerSeeds = [
    {
      id: "seed-banner-001",
      sponsorName: "Festival de Rock Omega 2026",
      mediaType: "IMAGE" as const,
      mediaUrl:
        "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1680&h=360&fit=crop&q=80",
      linkUrl: "/event/festival-de-rock-omega-2026",
      sortOrder: 0,
    },
    {
      id: "seed-banner-002",
      sponsorName: "OmegaConf Tech 2026",
      mediaType: "IMAGE" as const,
      mediaUrl:
        "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1680&h=360&fit=crop&q=80",
      linkUrl: "/event/omegaconf-tech-2026",
      sortOrder: 1,
    },
    {
      id: "seed-banner-003",
      sponsorName: "Crie seu evento na EventosOmega",
      mediaType: "IMAGE" as const,
      mediaUrl:
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1680&h=360&fit=crop&q=80",
      linkUrl: "/dashboard/events/new",
      sortOrder: 2,
    },
  ] as const;

  for (const banner of bannerSeeds) {
    await prisma.platformBannerMedia.upsert({
      where: { id: banner.id },
      update: {
        sponsorName: banner.sponsorName,
        mediaType: banner.mediaType,
        mediaUrl: banner.mediaUrl,
        linkUrl: banner.linkUrl,
        sortOrder: banner.sortOrder,
        isActive: true,
      },
      create: {
        id: banner.id,
        sponsorName: banner.sponsorName,
        mediaType: banner.mediaType,
        mediaUrl: banner.mediaUrl,
        linkUrl: banner.linkUrl,
        sortOrder: banner.sortOrder,
        isActive: true,
      },
    });
  }
  console.log(`✅ Banners promocionais criados: ${bannerSeeds.length}`);

  console.log("\n🎉 Seed concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

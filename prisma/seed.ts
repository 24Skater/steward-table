import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "demo1234";

async function main() {
  console.log("🌱 Starting seed...");

  // ─────────────────────────────────────────────
  // 1. User
  // ─────────────────────────────────────────────
  console.log("Creating user...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: "owner@gracefellowship.demo" },
    update: { passwordHash },
    create: {
      email: "owner@gracefellowship.demo",
      emailVerified: new Date(),
      name: "Maria Rodriguez",
      passwordHash,
      status: "ACTIVE",
    },
  });
  console.log(`  User: ${user.name} <${user.email}> (${user.id})`);

  // ─────────────────────────────────────────────
  // 2. Church
  // ─────────────────────────────────────────────
  console.log("Creating church...");
  const church = await prisma.church.upsert({
    where: { slug: "grace-fellowship" },
    update: {},
    create: {
      slug: "grace-fellowship",
      name: "Grace Fellowship",
      timezone: "America/New_York",
      locale: "EN",
      currency: "USD",
      status: "ACTIVE",
    },
  });
  console.log(`  Church: ${church.name} (${church.id})`);

  // ─────────────────────────────────────────────
  // 3. Membership
  // ─────────────────────────────────────────────
  console.log("Creating membership...");
  const membership = await prisma.membership.upsert({
    where: {
      userId_churchId: { userId: user.id, churchId: church.id },
    },
    update: {},
    create: {
      userId: user.id,
      churchId: church.id,
      roles: ["OWNER"],
      status: "ACTIVE",
    },
  });
  console.log(`  Membership: OWNER (${membership.id})`);

  // ─────────────────────────────────────────────
  // 4. ChurchSettings
  // ─────────────────────────────────────────────
  console.log("Creating church settings...");
  const settings = await prisma.churchSettings.upsert({
    where: { churchId: church.id },
    update: {},
    create: {
      churchId: church.id,
      stripeMode: "BYO",
      acceptCash: true,
      acceptZelle: true,
      replyToEmail: "orders@gracefellowship.demo",
      displayName: "Grace Fellowship",
    },
  });
  console.log(`  ChurchSettings (${settings.id})`);

  // ─────────────────────────────────────────────
  // 5. OrderCounter
  // ─────────────────────────────────────────────
  console.log("Creating order counter...");
  await prisma.orderCounter.upsert({
    where: { churchId: church.id },
    update: {},
    create: {
      churchId: church.id,
      value: 0,
    },
  });
  console.log("  OrderCounter: 0");

  // ─────────────────────────────────────────────
  // 6. Catalog
  // ─────────────────────────────────────────────
  console.log("Creating catalog...");
  const catalog = await prisma.catalog.upsert({
    where: {
      churchId_slug: { churchId: church.id, slug: "sunday-lunch" },
    },
    update: {},
    create: {
      churchId: church.id,
      name: "Sunday Lunch Menu",
      slug: "sunday-lunch",
      status: "OPEN",
    },
  });
  console.log(`  Catalog: ${catalog.name} (${catalog.id})`);

  // ─────────────────────────────────────────────
  // 7. Items
  // ─────────────────────────────────────────────
  console.log("Creating menu items...");

  const pupusasQueso = await prisma.item.upsert({
    where: {
      // No unique on name, so use a synthetic lookup via churchId + name.
      // Since there's no compound unique, we need to create or skip manually.
      // We'll use findFirst + createMany pattern via upsert on id by doing a
      // two-step: find or create.
      id: "seed-item-pupusas-queso",
    },
    update: {},
    create: {
      id: "seed-item-pupusas-queso",
      churchId: church.id,
      name: "Pupusas de Queso",
      description: "Homemade corn tortillas filled with cheese",
      defaultPrice: 350,
      status: "ACTIVE",
    },
  });

  const pupusasFrijoles = await prisma.item.upsert({
    where: { id: "seed-item-pupusas-frijoles" },
    update: {},
    create: {
      id: "seed-item-pupusas-frijoles",
      churchId: church.id,
      name: "Pupusas de Frijoles",
      description: "Homemade corn tortillas filled with beans",
      defaultPrice: 350,
      status: "ACTIVE",
    },
  });

  const horchata = await prisma.item.upsert({
    where: { id: "seed-item-horchata" },
    update: {},
    create: {
      id: "seed-item-horchata",
      churchId: church.id,
      name: "Horchata",
      description: "Sweet rice drink with cinnamon",
      defaultPrice: 250,
      status: "ACTIVE",
    },
  });

  console.log(
    `  Items: ${pupusasQueso.name}, ${pupusasFrijoles.name}, ${horchata.name}`
  );

  // ─────────────────────────────────────────────
  // 8. CatalogItems
  // ─────────────────────────────────────────────
  console.log("Linking items to catalog...");

  for (const item of [pupusasQueso, pupusasFrijoles, horchata]) {
    await prisma.catalogItem.upsert({
      where: {
        catalogId_itemId: { catalogId: catalog.id, itemId: item.id },
      },
      update: {},
      create: {
        catalogId: catalog.id,
        itemId: item.id,
        isAvailable: true,
      },
    });
  }
  console.log("  CatalogItems: 3 linked");

  // ─────────────────────────────────────────────
  // 9. ModifierGroup
  // ─────────────────────────────────────────────
  console.log("Creating modifier group...");
  const modifierGroup = await prisma.modifierGroup.upsert({
    where: { id: "seed-modifier-group-addons" },
    update: {},
    create: {
      id: "seed-modifier-group-addons",
      churchId: church.id,
      name: "Add-ons",
      defaultMinSelections: 0,
      defaultMaxSelections: 2,
      defaultIsRequired: false,
    },
  });
  console.log(`  ModifierGroup: ${modifierGroup.name} (${modifierGroup.id})`);

  // ─────────────────────────────────────────────
  // 10. ModifierOptions
  // ─────────────────────────────────────────────
  console.log("Creating modifier options...");

  const modifierOptions = [
    {
      id: "seed-mod-opt-extra-cheese",
      name: "Extra cheese",
      priceDelta: 100,
      sortOrder: 0,
    },
    {
      id: "seed-mod-opt-curtido",
      name: "Curtido (pickled cabbage)",
      priceDelta: 0,
      sortOrder: 1,
    },
    {
      id: "seed-mod-opt-hot-sauce",
      name: "Hot sauce",
      priceDelta: 0,
      sortOrder: 2,
    },
  ];

  for (const opt of modifierOptions) {
    await prisma.modifierOption.upsert({
      where: { id: opt.id },
      update: {},
      create: {
        id: opt.id,
        groupId: modifierGroup.id,
        name: opt.name,
        priceDelta: opt.priceDelta,
        sortOrder: opt.sortOrder,
      },
    });
  }
  console.log(`  ModifierOptions: ${modifierOptions.length} created`);

  // ─────────────────────────────────────────────
  // 11. ItemModifierGroup — bind add-ons to Pupusas de Queso
  // ─────────────────────────────────────────────
  console.log("Binding modifier group to item...");
  await prisma.itemModifierGroup.upsert({
    where: {
      itemId_groupId: {
        itemId: pupusasQueso.id,
        groupId: modifierGroup.id,
      },
    },
    update: {},
    create: {
      itemId: pupusasQueso.id,
      groupId: modifierGroup.id,
      sortOrder: 0,
    },
  });
  console.log(
    `  ItemModifierGroup: "${modifierGroup.name}" bound to "${pupusasQueso.name}"`
  );

  // ─────────────────────────────────────────────
  // 12. Customers — deleteMany first for idempotency
  // Must delete orders before customers due to FK constraint
  // ─────────────────────────────────────────────
  console.log("Clearing and re-creating customers...");
  // Delete orders that belong to the demo customers first
  const demoCustomers = await prisma.customer.findMany({
    where: {
      churchId: church.id,
      emailNormalized: { in: ["ana.garcia@demo.com", "carlos.mendez@demo.com"] },
    },
    select: { id: true },
  });
  if (demoCustomers.length > 0) {
    await prisma.order.deleteMany({
      where: { customerId: { in: demoCustomers.map((c) => c.id) } },
    });
  }
  await prisma.customer.deleteMany({
    where: {
      churchId: church.id,
      emailNormalized: {
        in: ["ana.garcia@demo.com", "carlos.mendez@demo.com"],
      },
    },
  });

  const anaGarcia = await prisma.customer.create({
    data: {
      churchId: church.id,
      name: "Ana García",
      email: "ana.garcia@demo.com",
      emailNormalized: "ana.garcia@demo.com",
    },
  });

  const carlosMendez = await prisma.customer.create({
    data: {
      churchId: church.id,
      name: "Carlos Mendez",
      email: "carlos.mendez@demo.com",
      emailNormalized: "carlos.mendez@demo.com",
    },
  });

  console.log(`  Customers: ${anaGarcia.name}, ${carlosMendez.name}`);

  // ─────────────────────────────────────────────
  // 13. Orders — deleteMany first for idempotency
  // ─────────────────────────────────────────────
  console.log("Clearing and re-creating orders...");
  await prisma.order.deleteMany({
    where: {
      churchId: church.id,
      number: { in: [1001, 1002, 1003] },
    },
  });

  // Order #1 — Ana García, IN_KITCHEN, PICKUP
  const order1 = await prisma.order.create({
    data: {
      churchId: church.id,
      catalogId: catalog.id,
      customerId: anaGarcia.id,
      number: 1001,
      channel: "ONLINE",
      fulfillment: "PICKUP",
      status: "IN_KITCHEN",
      currency: "USD",
      subtotal: 700,
      tax: 0,
      tip: 0,
      total: 700,
      receiptLanguageVersion: 1,
      items: {
        create: {
          itemId: pupusasQueso.id,
          itemName: "Pupusas de Queso",
          unitPrice: 350,
          quantity: 2,
          modifierSnapshot: {},
          subtotal: 700,
          tax: 0,
          total: 700,
        },
      },
    },
  });

  // Order #2 — Carlos Mendez, SUBMITTED, DELIVERY
  const order2 = await prisma.order.create({
    data: {
      churchId: church.id,
      catalogId: catalog.id,
      customerId: carlosMendez.id,
      number: 1002,
      channel: "ONLINE",
      fulfillment: "DELIVERY",
      status: "SUBMITTED",
      currency: "USD",
      subtotal: 1050,
      tax: 0,
      tip: 100,
      total: 1150,
      receiptLanguageVersion: 1,
      items: {
        create: {
          itemId: pupusasQueso.id,
          itemName: "Pupusas de Queso",
          unitPrice: 350,
          quantity: 3,
          modifierSnapshot: {},
          subtotal: 1050,
          tax: 0,
          total: 1050,
        },
      },
    },
  });

  // Order #3 — Ana García, READY, PICKUP
  const order3 = await prisma.order.create({
    data: {
      churchId: church.id,
      catalogId: catalog.id,
      customerId: anaGarcia.id,
      number: 1003,
      channel: "ONLINE",
      fulfillment: "PICKUP",
      status: "READY",
      currency: "USD",
      subtotal: 350,
      tax: 0,
      tip: 0,
      total: 350,
      receiptLanguageVersion: 1,
      items: {
        create: {
          itemId: horchata.id,
          itemName: "Horchata",
          unitPrice: 250,
          quantity: 1,
          modifierSnapshot: {},
          subtotal: 250,
          tax: 0,
          total: 250,
        },
      },
    },
  });

  console.log(
    `  Orders: #${order1.number} (${order1.status}), #${order2.number} (${order2.status}), #${order3.number} (${order3.status})`
  );

  console.log("\nSeed complete.");
}

async function seedSecondChurch() {
  console.log("\n🌱 Seeding second demo church (Riverside Chapel)...");

  const user = await prisma.user.upsert({
    where: { email: "admin@riversidechapel.demo" },
    update: {},
    create: {
      email: "admin@riversidechapel.demo",
      emailVerified: new Date(),
      name: "James Park",
      status: "ACTIVE",
    },
  });

  const church = await prisma.church.upsert({
    where: { slug: "riverside-chapel" },
    update: {},
    create: {
      name: "Riverside Chapel",
      slug: "riverside-chapel",
      status: "ACTIVE",
      accentColor: "#6366f1",
      locale: "EN",
      currency: "USD",
      timezone: "America/Los_Angeles",
    },
  });

  await prisma.membership.upsert({
    where: { userId_churchId: { userId: user.id, churchId: church.id } },
    update: {},
    create: {
      userId: user.id,
      churchId: church.id,
      roles: ["OWNER"],
      status: "ACTIVE",
    },
  });

  const catalog = await prisma.catalog.upsert({
    where: { churchId_slug: { churchId: church.id, slug: "sunday-brunch" } },
    update: {},
    create: {
      churchId: church.id,
      name: "Sunday Brunch",
      slug: "sunday-brunch",
      description: "Fresh weekend brunch items",
      status: "CLOSED",
    },
  });

  const itemDefs = [
    { name: "Pancakes", defaultPrice: 700 },
    { name: "Avocado Toast", defaultPrice: 900 },
    { name: "Fresh OJ", defaultPrice: 350 },
  ];

  for (const def of itemDefs) {
    const item = await prisma.item.upsert({
      where: { id: `riverside-${def.name.toLowerCase().replace(/\s/g, "-")}` },
      update: {},
      create: {
        id: `riverside-${def.name.toLowerCase().replace(/\s/g, "-")}`,
        churchId: church.id,
        name: def.name,
        defaultPrice: def.defaultPrice,
        status: "ACTIVE",
      },
    });
    await prisma.catalogItem.upsert({
      where: { catalogId_itemId: { catalogId: catalog.id, itemId: item.id } },
      update: {},
      create: { catalogId: catalog.id, itemId: item.id, sortOrder: 0 },
    });
  }

  console.log(`  Church: ${church.name} (slug: ${church.slug})`);
  console.log(`  Admin: ${user.name} <${user.email}>`);
  console.log("  Catalog: Sunday Brunch (CLOSED)");
}

const isMulti = process.argv.includes("--multi");

main()
  .then(() => isMulti ? seedSecondChurch() : Promise.resolve())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

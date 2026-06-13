import type { CatalogTemplate } from "./types";

export const pupusaSaleTemplate: CatalogTemplate = {
  key: "pupusa-sale",
  name: "Pupusa Sale",
  description: "Traditional Salvadoran pupusa fundraiser",
  items: [
    {
      name: "Pupusas de Queso",
      nameEs: "Pupusas de Queso",
      description: "Cheese pupusas",
      descriptionEs: "Pupusas rellenas de queso",
      defaultPrice: 300,
      station: "food",
      modifierGroupNames: ["Quantity Pack"],
    },
    {
      name: "Pupusas de Chicharrón",
      nameEs: "Pupusas de Chicharrón",
      description: "Pork pupusas",
      descriptionEs: "Pupusas rellenas de chicharrón",
      defaultPrice: 350,
      station: "food",
      modifierGroupNames: ["Quantity Pack"],
    },
    {
      name: "Pupusas de Frijol",
      nameEs: "Pupusas de Frijol",
      description: "Bean pupusas",
      descriptionEs: "Pupusas rellenas de frijoles",
      defaultPrice: 300,
      station: "food",
      modifierGroupNames: ["Quantity Pack"],
    },
    {
      name: "Curtido",
      nameEs: "Curtido",
      description: "Pickled slaw side",
      descriptionEs: "Ensalada curtida",
      defaultPrice: 50,
      station: "sides",
      modifierGroupNames: [],
    },
    {
      name: "Horchata (Large)",
      nameEs: "Horchata (Grande)",
      description: "Large horchata drink",
      descriptionEs: "Bebida de horchata grande",
      defaultPrice: 300,
      station: "drinks",
      modifierGroupNames: [],
    },
  ],
  modifierGroups: [
    {
      name: "Quantity Pack",
      nameEs: "Paquete de Cantidad",
      minSelections: 0,
      maxSelections: 1,
      isRequired: false,
      options: [
        {
          name: "Single (x1)",
          nameEs: "Individual (x1)",
          priceDelta: 0,
          isDefault: true,
        },
        {
          name: "Dozen (x12)",
          nameEs: "Docena (x12)",
          priceDelta: 3000,
          isDefault: false,
        },
      ],
    },
  ],
};

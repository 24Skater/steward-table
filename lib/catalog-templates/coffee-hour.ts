import type { CatalogTemplate } from "./types";

export const coffeeHourTemplate: CatalogTemplate = {
  key: "coffee-hour",
  name: "Coffee Hour",
  description: "Sunday coffee hour",
  items: [
    {
      name: "Drip Coffee",
      nameEs: "Café de Goteo",
      description: "Freshly brewed drip coffee",
      descriptionEs: "Café de goteo recién preparado",
      defaultPrice: 200,
      station: "drinks",
      modifierGroupNames: ["Coffee Add-ons"],
    },
    {
      name: "Pastry of the Day",
      nameEs: "Pastelería del Día",
      description: "Rotating selection of fresh pastries",
      descriptionEs: "Selección rotativa de pastelerías frescas",
      defaultPrice: 300,
      station: "food",
      modifierGroupNames: [],
    },
    {
      name: "Fresh Fruit Cup",
      nameEs: "Tazón de Fruta Fresca",
      description: "Seasonal fresh fruit cup",
      descriptionEs: "Tazón de fruta fresca de temporada",
      defaultPrice: 300,
      station: "food",
      modifierGroupNames: [],
    },
    {
      name: "Orange Juice",
      nameEs: "Jugo de Naranja",
      description: "Fresh orange juice",
      descriptionEs: "Jugo de naranja natural",
      defaultPrice: 250,
      station: "drinks",
      modifierGroupNames: [],
    },
  ],
  modifierGroups: [
    {
      name: "Coffee Add-ons",
      nameEs: "Complementos para el Café",
      minSelections: 0,
      maxSelections: 3,
      isRequired: false,
      options: [
        {
          name: "Cream",
          nameEs: "Crema",
          priceDelta: 0,
          isDefault: false,
        },
        {
          name: "Sugar",
          nameEs: "Azúcar",
          priceDelta: 0,
          isDefault: false,
        },
        {
          name: "Oat Milk",
          nameEs: "Leche de Avena",
          priceDelta: 50,
          isDefault: false,
        },
      ],
    },
  ],
};

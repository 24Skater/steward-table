export interface CatalogTemplateItem {
  name: string;
  nameEs: string;
  description?: string;
  descriptionEs?: string;
  defaultPrice: number;
  modifierGroupNames: string[];
}

export interface CatalogTemplateModifierGroup {
  name: string;
  nameEs: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  options: Array<{
    name: string;
    nameEs: string;
    priceDelta: number;
    isDefault: boolean;
  }>;
}

export interface CatalogTemplate {
  name: string;
  description: string;
  items: CatalogTemplateItem[];
  modifierGroups: CatalogTemplateModifierGroup[];
}

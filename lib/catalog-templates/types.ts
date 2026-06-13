export interface CatalogTemplateItem {
  name: string;
  nameEs: string;
  description?: string;
  descriptionEs?: string;
  defaultPrice: number;
  station?: string;
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
  key: string;
  name: string;
  description: string;
  items: CatalogTemplateItem[];
  modifierGroups: CatalogTemplateModifierGroup[];
}

export const MANOR_V7_LOVESDAY_CROP_ID = 627;
export const MANOR_V7_LOVESDAY_ANIMAL_ID = 1599;
export const MANOR_V7_LOVESDAY_CROP_SEED_PRICE = 99;
export const MANOR_V7_LOVESDAY_CROP_SALE_PRICE = 99;
export const MANOR_V7_LOVESDAY_SALE_BATCH = 99;
export const MANOR_V7_LOVESDAY_SALE_MULTIPLIER = 9;

export interface ManorV7SaleQuote {
  unitPrice: number;
  multiplier: number;
  revenue: number;
}

export function manorV7EffectiveCropSeedPrice(cropId: number, standardPrice: number): number {
  return cropId === MANOR_V7_LOVESDAY_CROP_ID
    ? MANOR_V7_LOVESDAY_CROP_SEED_PRICE
    : standardPrice;
}

export function manorV7EffectiveCropSalePrice(cropId: number, standardPrice: number): number {
  return cropId === MANOR_V7_LOVESDAY_CROP_ID
    ? MANOR_V7_LOVESDAY_CROP_SALE_PRICE
    : standardPrice;
}

export function manorV7CropSaleQuote(cropId: number, standardPrice: number, quantity: number): ManorV7SaleQuote {
  const unitPrice = manorV7EffectiveCropSalePrice(cropId, standardPrice);
  return saleQuote(unitPrice, quantity, cropId === MANOR_V7_LOVESDAY_CROP_ID);
}

export function manorV7PastureProductSaleQuote(
  animalId: number,
  standardPrice: number,
  quantity: number
): ManorV7SaleQuote {
  return saleQuote(standardPrice, quantity, animalId === MANOR_V7_LOVESDAY_ANIMAL_ID);
}

function saleQuote(unitPrice: number, quantity: number, lovesdayProduct: boolean): ManorV7SaleQuote {
  const multiplier = lovesdayProduct && quantity > 0 && quantity % MANOR_V7_LOVESDAY_SALE_BATCH === 0
    ? MANOR_V7_LOVESDAY_SALE_MULTIPLIER
    : 1;
  return { unitPrice, multiplier, revenue: unitPrice * quantity * multiplier };
}

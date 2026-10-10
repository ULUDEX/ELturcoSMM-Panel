// Amounts are in kuruş, per the service's pricing unit (1,000 units or package).
export function providerMarkupPercent(costPrice: number) {
  return costPrice < 1000 ? 75 : costPrice < 5000 ? 65 : 50;
}
export function providerSalePrice(costPrice: number) {
  if (!Number.isFinite(costPrice) || costPrice < 0) throw new Error("Geçersiz alış fiyatı.");
  return Math.round(costPrice * (100 + providerMarkupPercent(costPrice)) / 100);
}

export const propertyKinds=[['LAND','أرض'],['APARTMENT','شقة'],['VILLA','فيلا'],['FLOOR','دور'],['BUILDING','عمارة'],['SHOWROOM','معرض'],['SHOP','محلات'],['KIOSK','كشك'],['FOOD_TRUCK','فود ترك']] as const;
export const propertyUses=[['Residential','سكني'],['Commercial','تجاري']] as const;
export type PropertyKind=typeof propertyKinds[number][0];

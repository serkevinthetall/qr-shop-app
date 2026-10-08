export type PickupPoint = {
  id: number;
  name: string;
  address: string;
  township?: string | null;
  sequence?: number;
};

export type FulfillmentMethod = 'pickup' | 'delivery';

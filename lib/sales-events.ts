export interface SaleEvent {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  description: string;
  expectedDiscountRange: [number, number]; // [min, max]
}

// Ensure the dates are somewhat dynamic so they don't immediately expire.
// In a real app, these would be updated yearly.
const currentYear = new Date().getFullYear();

export const upcomingSales: SaleEvent[] = [
  {
    id: "prime-day",
    name: "Amazon Prime Day",
    startDate: new Date(currentYear, 6, 15), // July 15
    endDate: new Date(currentYear, 6, 16),
    description: "Historically one of the best times to buy Amazon devices, gaming laptops, and premium electronics.",
    expectedDiscountRange: [2000, 5000],
  },
  {
    id: "great-indian-festival",
    name: "Amazon Great Indian Festival",
    startDate: new Date(currentYear, 9, 8), // October 8
    endDate: new Date(currentYear, 9, 15),
    description: "Largest festive discounts on flagship electronics.",
    expectedDiscountRange: [5000, 15000],
  },
  {
    id: "big-billion-days",
    name: "Flipkart Big Billion Days",
    startDate: new Date(currentYear, 9, 8), // October 8
    endDate: new Date(currentYear, 9, 15),
    description: "Historically the lowest prices for smartphones and laptops.",
    expectedDiscountRange: [5000, 15000],
  },
  {
    id: "black-friday",
    name: "Black Friday",
    startDate: new Date(currentYear, 10, 24), // Nov 24
    endDate: new Date(currentYear, 10, 27),
    description: "Best international deals and accessories.",
    expectedDiscountRange: [2000, 10000],
  },
];

export function getNextUpcomingSale(): SaleEvent | null {
  const now = new Date();
  
  // Find the next sale that hasn't ended yet
  const upcoming = upcomingSales
    .filter(sale => sale.endDate >= now)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  return upcoming.length > 0 ? upcoming[0] : null;
}

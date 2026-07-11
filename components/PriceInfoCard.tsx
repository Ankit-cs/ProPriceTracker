"use client";

import { LucideIcon } from "lucide-react";
import { formatPrice } from "@/lib/utils"; // I will make sure this exists or define it here if needed, but wait, ProPriceTracker uses its own formatPrice in ProductCard. I'll just accept a string for `value`.

interface Props {
  title: string;
  icon: LucideIcon;
  value: string;
  borderColorClass?: string;
  bgColorClass?: string;
  iconColorClass?: string;
}

export default function PriceInfoCard({ 
  title, 
  icon: Icon, 
  value, 
  borderColorClass = "border-neutral-200",
  bgColorClass = "bg-neutral-50",
  iconColorClass = "text-neutral-500"
}: Props) {
  return (
    <div className={`flex-1 min-w-[120px] flex flex-col gap-1 border-l-[3px] rounded-r-lg px-4 py-3 shadow-sm ${borderColorClass} ${bgColorClass}`}>
      <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">{title}</p>
      
      <div className="flex gap-2 items-center mt-1">
        <Icon className={`w-5 h-5 ${iconColorClass}`} />
        <p className="text-lg font-bold text-neutral-900 truncate" title={value}>{value}</p>
      </div>
    </div>
  );
}

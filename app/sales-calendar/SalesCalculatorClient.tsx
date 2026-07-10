"use client";

import { create } from "zustand";
import { Calculator, ArrowRight, IndianRupee, Tag } from "lucide-react";

interface SalesStore {
  monthlySpend: number;
  category: string;
  selectedEvent: number;
  setMonthlySpend: (val: number) => void;
  setCategory: (val: string) => void;
  setSelectedEvent: (index: number) => void;
}

const useSalesStore = create<SalesStore>((set) => ({
  monthlySpend: 5000,
  category: "electronics",
  selectedEvent: 0,
  setMonthlySpend: (val) => set({ monthlySpend: val }),
  setCategory: (val) => set({ category: val }),
  setSelectedEvent: (index) => set({ selectedEvent: index }),
}));

const EVENTS = [
  { name: "Amazon Prime Day", date: "July 2026", avgDiscount: 0.15 },
  { name: "Great Indian Festival", date: "October 2026", avgDiscount: 0.20 },
  { name: "Black Friday", date: "November 2026", avgDiscount: 0.25 },
];

const CATEGORIES = [
  { id: "electronics", name: "Electronics", multiplier: 1.2 },
  { id: "fashion", name: "Fashion", multiplier: 1.5 },
  { id: "home", name: "Home & Kitchen", multiplier: 1.0 },
  { id: "groceries", name: "Groceries", multiplier: 0.5 },
];

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const formSchema = z.object({
  monthlySpend: z.number().min(100, "Spend must be at least ₹100").max(1000000, "Spend cannot exceed ₹1,000,000"),
  category: z.string().min(1, "Please select a category"),
  selectedEvent: z.number().min(0).max(EVENTS.length - 1)
});

export default function SalesCalculatorClient() {
  const { monthlySpend, category, selectedEvent, setMonthlySpend, setCategory, setSelectedEvent } = useSalesStore();

  const event = EVENTS[selectedEvent];
  const cat = CATEGORIES.find(c => c.id === category);
  
  // Predict savings based on how much they spend per month * months until event * discount rate * category multiplier
  const currentMonthIndex = new Date().getMonth();
  const eventMonthIndex = new Date(Date.parse(event.date)).getMonth();
  const monthsToWait = Math.max(1, eventMonthIndex - currentMonthIndex);
  
  const estimatedSavings = Math.round(
    (monthlySpend * monthsToWait) * event.avgDiscount * (cat?.multiplier || 1)
  );

  // React Hook Form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      monthlySpend: monthlySpend,
      category: category,
      selectedEvent: selectedEvent,
    },
    mode: "onChange",
  });

  const { watch } = form;
  const currentValues = watch();

  // Calculate Progress
  let progressCount = 0;
  if (currentValues.monthlySpend > 0) progressCount += 1;
  if (currentValues.category) progressCount += 1;
  if (currentValues.selectedEvent !== undefined) progressCount += 1;
  const progressPercent = (progressCount / 3) * 100;

  // Sync back to Zustand when values change successfully
  const onSubmit = (values: z.infer<typeof formSchema>) => {
    setMonthlySpend(values.monthlySpend);
    setCategory(values.category);
    setSelectedEvent(values.selectedEvent);
    toast.success("Settings saved! Reminder has been scheduled.", {
      description: `We will notify you before the ${EVENTS[values.selectedEvent].name}.`,
    });
  };

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Interactive Form */}
      <div className="flex-1 bg-surface rounded-2xl border border-line p-6 space-y-6">
        
        {/* Progress Bar Header */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-2">
            <h2 className="text-xl font-display font-semibold">Calculator Setup</h2>
            <span className="text-xs font-bold text-accent">{Math.round(progressPercent)}% Complete</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Event Selection */}
            <FormField
              control={form.control}
              name="selectedEvent"
              render={({ field }) => (
                <FormItem className="">
                  <FormLabel className="">Upcoming Sales Event</FormLabel>
                  <div className="grid gap-3">
                    {EVENTS.map((e, idx) => (
                      <div
                        key={e.name}
                        onClick={() => field.onChange(idx)}
                        className={`flex items-center justify-between p-4 rounded-xl border text-left cursor-pointer transition-all ${
                          field.value === idx 
                            ? "border-accent bg-accent/5 ring-1 ring-accent" 
                            : "border-line bg-background hover:border-ink/20"
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-ink">{e.name}</div>
                          <div className="text-sm text-ink-muted">{e.date}</div>
                        </div>
                        <div className={`text-sm font-bold ${field.value === idx ? "text-accent" : "text-ink-soft"}`}>
                          ~{e.avgDiscount * 100}% off
                        </div>
                      </div>
                    ))}
                  </div>
                  <FormMessage className="" />
                </FormItem>
              )}
            />

            {/* Category Selection */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem className="">
                  <FormLabel className="">Category</FormLabel>
                  <FormControl>
                    <select 
                      {...field}
                      className="w-full bg-background border border-line rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="" disabled>Select a category...</option>
                      {CATEGORIES.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage className="" />
                </FormItem>
              )}
            />

            {/* Monthly Spend */}
            <FormField
              control={form.control}
              name="monthlySpend"
              render={({ field }) => (
                <FormItem className="">
                  <FormLabel className="">Monthly Spend (₹)</FormLabel>
                  <div className="relative">
                    <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                    <FormControl>
                      <input 
                        type="number" 
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="w-full bg-background border border-line rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </FormControl>
                  </div>
                  <FormMessage className="" />
                </FormItem>
              )}
            />

          </form>
        </Form>
      </div>

      {/* Result Panel */}
      <div className="w-full md:w-[320px] shrink-0">
        <div className="bg-ink text-background rounded-2xl p-6 sticky top-24">
          <div className="w-12 h-12 rounded-full bg-background/10 flex items-center justify-center mb-6">
            <Calculator className="w-6 h-6 text-background" />
          </div>
          
          <h3 className="text-lg font-medium text-background/80 mb-2">Estimated Savings</h3>
          <div className="text-5xl font-display font-bold mb-6">
            ₹{estimatedSavings.toLocaleString()}
          </div>
          
          <p className="text-sm text-background/70 mb-8 leading-relaxed">
            By delaying your purchases of <span className="font-semibold text-background">{cat?.name.toLowerCase()}</span> until the <span className="font-semibold text-background">{event.name}</span>, you could save approximately ₹{estimatedSavings.toLocaleString()}.
          </p>
          
          <button 
            onClick={() => form.handleSubmit(onSubmit)()}
            className="w-full bg-accent text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 hover:bg-accent/90 transition-colors"
          >
            Set Reminder <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

import SalesCalculatorClient from "./SalesCalculatorClient";
import { Calendar } from "lucide-react";

export default function SalesCalendarPage() {
  return (
    <main className="min-h-screen bg-background text-ink relative pt-24 pb-12 overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 relative z-10">
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
            <Calendar className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-4xl font-bold font-display text-ink mb-4 tracking-tight">Sales Calendar & Predictor</h1>
          <p className="text-ink-soft text-lg">Calculate your potential savings by waiting for major upcoming e-commerce events.</p>
        </div>

        <SalesCalculatorClient />
      </div>
    </main>
  );
}

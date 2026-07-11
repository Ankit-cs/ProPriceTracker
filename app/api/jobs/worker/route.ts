import { NextResponse } from "next/server";
import { processScrapingJob } from "@/app/actions";

export async function POST(req: Request) {
  try {
    const { job_id } = await req.json();
    if (!job_id) return NextResponse.json({ error: "Missing job_id" }, { status: 400 });

    // Call the centralized business logic function inside actions.tsx
    const result = await processScrapingJob(job_id);
    
    if (result.error) {
       return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, product: result.product });
  } catch (err: any) {
    console.error("Worker error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

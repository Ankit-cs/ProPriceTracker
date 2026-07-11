import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getServiceRoleClient, BYPASS_AUTH } from "@/utils/supabase/service";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing job_id" }, { status: 400 });

    const supabase = BYPASS_AUTH ? getServiceRoleClient() : createClient(await cookies());

    const { data: job, error } = await supabase
      .from("scraping_jobs")
      .select("status, error_message, product_id")
      .eq("id", id)
      .maybeSingle();

    if (error || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      status: job.status,
      error_message: job.error_message,
      product_id: job.product_id
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

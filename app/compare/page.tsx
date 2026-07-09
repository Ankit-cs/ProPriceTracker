import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import CompareClient from "@/components/CompareClient";

export default async function ComparePage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <CompareClient user={user} />;
}

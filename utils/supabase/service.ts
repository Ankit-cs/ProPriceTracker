import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const BYPASS_AUTH = false; // Set to true only for local testing (disables auth)

export const getServiceRoleClient = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

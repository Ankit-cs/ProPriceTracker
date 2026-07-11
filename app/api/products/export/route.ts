import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { getMockUser, isBypassAuthEnabled } from "@/app/actions";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const getServiceRoleClient = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";

    const cookieStore = await cookies();
    const bypassAuth = await isBypassAuthEnabled();
    const supabase = bypassAuth ? getServiceRoleClient() : createClient(cookieStore);
    
    let user;
    if (bypassAuth) {
      user = await getMockUser();
    } else {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    }

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Fetch products that this user is tracking
    const { data: trackedRelations, error } = await supabase
      .from("user_tracked_products")
      .select(`
        *,
        product:products (
          *,
          price_history (*)
        )
      `)
      .eq("user_id", user.id);

    if (error) throw error;

    const products = trackedRelations ? trackedRelations.map(r => ({
      ...r.product,
      ...r,
      id: r.product.id // Keep the product id
    })) : [];

    if (format === "pdf") {
      const PDFDocument = (await import('pdfkit')).default;
      
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk) => chunks.push(chunk as Buffer));
      
      // Build the PDF
      doc.fontSize(20).text('ProPriceTracker - Product Export', { align: 'center' });
      doc.moveDown();
      
      if (products) {
        for (let i = 0; i < products.length; i++) {
          const p = products[i];
          doc.fontSize(14).text(`${i + 1}. ${p.name}`, { underline: true });
          doc.moveDown(0.5);
          
          try {
            if (p.image_url) {
              const imageRes = await fetch(p.image_url);
              if (imageRes.ok) {
                const arrayBuffer = await imageRes.arrayBuffer();
                doc.image(Buffer.from(arrayBuffer), { width: 150 });
                doc.moveDown(0.5);
              }
            }
          } catch (e) {
            console.error("Failed to load image for PDF", e);
          }

          doc.fontSize(10).fillColor('blue').text(`Product Link: ${p.url}`, { link: p.url, underline: true });
          doc.moveDown(0.5);
          doc.fillColor('black');
          doc.text(`Current Price: ${p.currency} ${p.current_price}`);
          doc.text(`In Stock: ${p.is_in_stock ? 'Yes' : 'No'}`);
          if (p.sold_by) doc.text(`Sold By: ${p.sold_by}`);
          if (p.delivery_date) doc.text(`Delivery: ${p.delivery_date}`);
          
          if (p.description) {
             doc.moveDown(0.5);
             doc.text(`Description:`);
             doc.fontSize(9).text(p.description, { width: 450, align: 'left' });
             doc.fontSize(10);
          }
          
          if (p.features) {
             doc.moveDown(0.5);
             doc.text(`Features:`);
             Object.entries(p.features).forEach(([key, value]) => {
                doc.text(`  - ${key}: ${value}`);
             });
          }
          doc.moveDown(2);
        }
      }
      
      doc.end();

      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
         doc.on('end', () => {
            resolve(Buffer.concat(chunks));
         });
         doc.on('error', (err) => {
            reject(err);
         });
      });

      return new NextResponse(pdfBuffer as any, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="products_export.pdf"`,
        },
      });
    }

    // Default to JSON
    return NextResponse.json({
      success: true,
      data: products
    });
  } catch (error: any) {
    console.error("Export API error:", error);
    return NextResponse.json({ error: error.message || "Failed to export data" }, { status: 500 });
  }
}

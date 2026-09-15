import { NextResponse } from "next/server";
import { buildTemplateWorkbook } from "@/lib/excel";

export async function GET() {
  const buffer = buildTemplateWorkbook();
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="lokalizasyon-sablonu.xlsx"',
    },
  });
}

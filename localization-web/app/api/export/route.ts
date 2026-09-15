import { NextRequest, NextResponse } from "next/server";
import { buildResultWorkbook } from "@/lib/excel";
import { OutputRecord } from "@/lib/constants";

export async function POST(req: NextRequest) {
  let body: { results?: OutputRecord[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Geçersiz istek." }, { status: 400 });
  }

  if (!Array.isArray(body.results) || body.results.length === 0) {
    return NextResponse.json({ success: false, error: "İndirilecek sonuç bulunamadı." }, { status: 400 });
  }

  const buffer = buildResultWorkbook(body.results);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="lokalize-edilmis.xlsx"',
    },
  });
}

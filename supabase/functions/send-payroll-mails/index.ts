// supabase/functions/send-payroll-mails/index.ts
// Deploy: supabase functions deploy send-payroll-mails
//
// Required secrets:
//   supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
//   supabase secrets set FROM_EMAIL=payroll@yourdomain.com

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL")!;

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { employees } = await req.json();

    if (!Array.isArray(employees) || employees.length === 0) {
      return Response.json(
        { error: "employees array required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const results = [];

    for (const emp of employees) {
      const { employee_id, name, email, month, pdfBase64 } = emp;

      // 이메일 없으면 스킵
      if (!email || !email.includes("@")) {
        results.push({ employee_id, ok: false, reason: "missing or invalid email" });
        continue;
      }

      if (!month) {
        results.push({ employee_id, ok: false, reason: "missing month" });
        continue;
      }

      const filename = `payroll_${name || employee_id}_${month}.pdf`;

      const body: Record<string, unknown> = {
        from:    FROM_EMAIL,
        to:      [email],
        subject: `[급여명세서] ${month} 근무분`,
        html: `
          <div style="font-family:sans-serif;line-height:1.7;color:#333;max-width:480px">
            <p style="font-size:11px;color:#999;letter-spacing:1px">DUNKIN'</p>
            <h2 style="font-size:20px;font-weight:500;margin:4px 0 16px">${month} 급여명세서</h2>
            <p>안녕하세요${name ? `, <strong>${name}</strong>` : ""}님.</p>
            <p>이번 달 급여명세서를 첨부 파일로 보내드립니다.<br>
               확인 후 문의사항이 있으시면 관리자에게 연락해주세요.</p>
            <p style="margin-top:24px;font-size:12px;color:#aaa">
              던킨 송도 랜드마크시티점
            </p>
          </div>
        `,
      };

      // PDF 첨부 (base64 있을 때만)
      if (pdfBase64) {
        body.attachments = [{ filename, content: pdfBase64 }];
      }

      const res  = await fetch("https://api.resend.com/emails", {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      results.push({
        employee_id,
        email,
        ok:       res.ok,
        provider: json,
      });

      // Resend 무료 플랜 rate limit 대비 (100ms 간격)
      await new Promise((r) => setTimeout(r, 100));
    }

    const successCount = results.filter((r) => r.ok).length;
    const failCount    = results.length - successCount;

    return Response.json(
      { success: true, successCount, failCount, results },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error("[send-payroll-mails]", error);
    return Response.json(
      { success: false, error: String(error?.message ?? error) },
      { status: 500, headers: corsHeaders }
    );
  }
});

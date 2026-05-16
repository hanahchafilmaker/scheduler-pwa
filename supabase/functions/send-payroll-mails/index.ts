// supabase/functions/send-payroll-mails/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.13";

export const config = { auth: false };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

async function sendAllMails(
  employees: Array<{
    employee_id: string;
    name?: string;
    email: string;
    month: string;
    pdfBase64?: string;
  }>,
  SMTP_USER: string,
  SMTP_PASS: string
) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  for (const emp of employees) {
    const { employee_id, name, email, month, pdfBase64 } = emp;

    if (!email || !email.includes("@")) {
      console.error(`[skip] invalid email: ${employee_id}`);
      continue;
    }
    if (!month) {
      console.error(`[skip] missing month: ${employee_id}`);
      continue;
    }

    try {
      const safeName = name || employee_id;
      const filename = `payroll_${safeName}_${month}.pdf`;

      const cleanBase64 = pdfBase64?.includes("base64,")
        ? pdfBase64.split("base64,")[1]
        : pdfBase64;

      const html = `
        <div style="font-family:sans-serif;line-height:1.7;color:#333;max-width:480px">
          <p style="font-size:11px;color:#999;letter-spacing:1px">DUNKIN'</p>
          <h2 style="font-size:20px;font-weight:500;margin:4px 0 16px">${month} 급여명세서</h2>
          <p>안녕하세요${name ? `, <strong>${name}</strong>` : ""}님.</p>
          <p>이번 달 급여명세서를 확인해주세요.<br>문의사항이 있으면 관리자에게 연락 바랍니다.</p>
          <p style="margin-top:24px;font-size:12px;color:#aaa">던킨 송도 랜드마크시티점</p>
        </div>
      `;

      const mailOptions = {
        from: `DUNKIN Payroll <${SMTP_USER}>`,
        to: email,
        subject: `[급여명세서] ${month} 근무분`,
        html,
        ...(cleanBase64 && {
          attachments: [{
            filename,
            content: Buffer.from(cleanBase64, "base64"),
            contentType: "application/pdf",
          }],
        }),
      };

      await transporter.sendMail(mailOptions);
      console.log(`[ok] sent to ${email}`);
    } catch (err) {
      console.error(`[fail] ${email}:`, String(err));
    }

    // Gmail rate limit 방지
    await new Promise((r) => setTimeout(r, 300));
  }
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const SMTP_USER = Deno.env.get("SMTP_USER");
    const SMTP_PASS = Deno.env.get("SMTP_PASS");

    if (!SMTP_USER || !SMTP_PASS) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing SMTP credentials" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const { employees } = await req.json();

    if (!Array.isArray(employees) || employees.length === 0) {
      return new Response(
        JSON.stringify({ error: "employees array required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 응답 먼저 반환하고 메일은 백그라운드에서 처리
    EdgeRuntime.waitUntil(sendAllMails(employees, SMTP_USER, SMTP_PASS));

    return new Response(
      JSON.stringify({
        success: true,
        message: `${employees.length}명 메일 발송 시작됨`,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("[send-payroll-mails]", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error?.message ?? error) }),
      { status: 500, headers: corsHeaders }
    );
  }
});
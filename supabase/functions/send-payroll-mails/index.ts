// supabase/functions/send-payroll-mails/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/smtp/mod.ts";

export const config = { auth: false };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  // =========================
  // CORS preflight
  // =========================
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // =========================
    // ENV 안전 처리 (중요)
    // =========================
    const SMTP_USER = Deno.env.get("SMTP_USER");
    const SMTP_PASS = Deno.env.get("SMTP_PASS");

    if (!SMTP_USER || !SMTP_PASS) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing SMTP credentials (SMTP_USER / SMTP_PASS)",
        }),
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    // =========================
    // Request body
    // =========================
    const { employees } = await req.json();

    if (!Array.isArray(employees) || employees.length === 0) {
      return new Response(
        JSON.stringify({ error: "employees array required" }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // =========================
    // SMTP Client
    // =========================
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: SMTP_USER,
          password: SMTP_PASS,
        },
      },
    });

    const results = [];

    // =========================
    // Send loop
    // =========================
    for (const emp of employees) {
      const { employee_id, name, email, month, pdfBase64 } = emp;

      if (!email || !email.includes("@")) {
        results.push({
          employee_id,
          ok: false,
          reason: "invalid email",
        });
        continue;
      }

      if (!month) {
        results.push({
          employee_id,
          ok: false,
          reason: "missing month",
        });
        continue;
      }

      try {
        const safeName = name || employee_id;

        const filename = `payroll_${safeName}_${month}.pdf`;

        // =========================
        // PDF base64 안전 처리
        // =========================
        const cleanBase64 =
          pdfBase64?.includes("base64,")
            ? pdfBase64.split("base64,")[1]
            : pdfBase64;

        const attachments = cleanBase64
          ? [
              {
                filename,
                content: Uint8Array.from(atob(cleanBase64), (c) =>
                  c.charCodeAt(0)
                ),
              },
            ]
          : undefined;

        // =========================
        // HTML
        // =========================
        const html = `
          <div style="font-family:sans-serif;line-height:1.7;color:#333;max-width:480px">
            <p style="font-size:11px;color:#999;letter-spacing:1px">DUNKIN'</p>
            <h2 style="font-size:20px;font-weight:500;margin:4px 0 16px">${month} 급여명세서</h2>
            <p>안녕하세요${name ? `, <strong>${name}</strong>` : ""}님.</p>
            <p>
              이번 달 급여명세서를 확인해주세요.<br>
              문의사항이 있으면 관리자에게 연락 바랍니다.
            </p>
            <p style="margin-top:24px;font-size:12px;color:#aaa">
              던킨 송도 랜드마크시티점
            </p>
          </div>
        `;

        // =========================
        // Send mail
        // =========================
        await client.send({
          from: `DUNKIN Payroll <${SMTP_USER}>`,
          to: email,
          subject: `[급여명세서] ${month} 근무분`,
          html,
          content: html,
          attachments,
        });

        results.push({
          employee_id,
          email,
          ok: true,
        });
      } catch (err) {
        results.push({
          employee_id,
          email,
          ok: false,
          error: String(err),
        });
      }

      // Gmail rate limit 방지
      await new Promise((r) => setTimeout(r, 300));
    }

    await client.close();

    // =========================
    // Response
    // =========================
    const successCount = results.filter((r) => r.ok).length;
    const failCount = results.length - successCount;

    return new Response(
      JSON.stringify({
        success: true,
        successCount,
        failCount,
        results,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("[send-payroll-mails]", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: String(error?.message ?? error),
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});
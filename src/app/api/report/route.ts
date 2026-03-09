// src/app/api/report/route.ts
import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
    const { type, description, operator } = await req.json();

    if (!description?.trim()) {
        return NextResponse.json({ error: 'Descrição obrigatória' }, { status: 400 });
    }

    const isBug = type === 'bug';
    const label = isBug ? 'Bug Report' : 'Sugestão de Melhoria';
    const color = isBug ? '#e74c3c' : '#6B9B7C';

    await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: 'nmc.supp@gmail.com',
        subject: `[Psique IA] ${label}`,
        html: `
      <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; background: #f1f8f4; padding: 32px 24px;">
        <div style="background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <div style="background: ${color}; padding: 24px 28px;">
            <p style="margin: 0; font-size: 22px; font-weight: 700; color: #fff;">${label}</p>
            <p style="margin: 6px 0 0; font-size: 13px; color: rgba(255,255,255,0.8);">Psique Feedback</p>
          </div>

          <!-- Body -->
          <div style="padding: 28px;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e8f5e9; font-size: 13px; color: #636e72; width: 110px; font-weight: 600;">Operador</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e8f5e9; font-size: 13px; color: #2d3436;">${operator || 'Não identificado'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e8f5e9; font-size: 13px; color: #636e72; font-weight: 600;">Tipo</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e8f5e9;">
                  <span style="background: ${isBug ? 'rgba(231,76,60,0.1)' : 'rgba(107,155,124,0.12)'}; color: ${color}; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                    ${isBug ? 'Bug' : 'Melhoria'}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-size: 13px; color: #636e72; font-weight: 600;">Data</td>
                <td style="padding: 10px 0; font-size: 13px; color: #2d3436;">${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
              </tr>
            </table>

            <p style="margin: 0 0 10px; font-size: 13px; font-weight: 600; color: #636e72;">Descrição</p>
            <div style="background: #f1f8f4; border-left: 4px solid ${color}; border-radius: 8px; padding: 16px; font-size: 14px; color: #2d3436; line-height: 1.7;">
              ${description.replace(/\n/g, '<br/>')}
            </div>
          </div>

          <!-- Footer -->
          <div style="padding: 16px 28px; border-top: 1px solid #e8f5e9; background: #f9fdf9;">
            <p style="margin: 0; font-size: 12px; color: #636e72;">Enviado automaticamente pelo sistema Psique IA</p>
          </div>
        </div>
      </div>
    `,
    });

    return NextResponse.json({ ok: true });
}
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export async function GET() {
  if (!supabase) {
    // Return default settings for demo
    return NextResponse.json({
      business: {
        companyName: "Murray's Field Service",
        phone: '(555) 123-4567',
        email: 'contact@murrayfsm.com',
        address: '123 Service Way, Austin, TX 78701',
        website: 'https://murrayfsm.com',
        timezone: 'America/New_York',
      },
      pricing: {
        defaultLaborRate: 85,
        defaultTaxRate: 8.25,
        quoteValidityDays: 30,
        invoiceDueDays: 14,
        emergencyMultiplier: 1.5,
        urgentMultiplier: 1.25,
      },
      ai: {
        phoneAiEnabled: true,
        aiQuoteGeneration: true,
        autoInvoice: true,
        autoReviewRequest: true,
        retellAgentId: process.env.RETELL_AGENT_ID || '',
        ollamaModel: 'llama3.2',
      },
      notifications: {
        emailNotifications: true,
        smsNotifications: true,
        whatsappNotifications: true,
        newJobAlert: true,
        paymentAlert: true,
        reviewAlert: true,
      },
    });
  }

  try {
    const { data: settings, error } = await supabase
      .from('settings')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return NextResponse.json(settings || {});
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!supabase) {
    // Just return success for demo
    console.log('[Settings] Would save:', body);
    return NextResponse.json({ success: true });
  }

  try {
    const { error } = await supabase
      .from('settings')
      .upsert({
        id: 1, // Single settings row
        business_settings: body.business,
        pricing_settings: body.pricing,
        ai_settings: body.ai,
        notification_settings: body.notifications,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    // Update environment variables if needed (in production, use a proper config service)
    if (body.pricing?.defaultLaborRate) {
      process.env.DEFAULT_LABOR_RATE = String(body.pricing.defaultLaborRate);
    }
    if (body.pricing?.defaultTaxRate) {
      process.env.DEFAULT_TAX_RATE = String(body.pricing.defaultTaxRate);
    }
    if (body.ai?.retellAgentId) {
      process.env.RETELL_AGENT_ID = body.ai.retellAgentId;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

/**
 * Cron Job Handler
 * ================
 * Scheduled tasks for Murray's FSM
 *
 * Run via Vercel Cron or external scheduler
 * Suggested schedule: Every hour
 */

import { NextRequest, NextResponse } from 'next/server';
import { invoicingService } from '@packages/services/invoicing';
import { reviewService } from '@packages/services/reviews';
import { paymentRemindersService } from '@packages/services/payment-reminders';
import { inventoryAlertsService } from '@packages/services/inventory-alerts';
import { recurringJobsService } from '@packages/services/recurring-jobs';
import { followUpsService } from '@packages/services/follow-ups';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/cron
 * Run all scheduled tasks
 *
 * Authorization: Requires CRON_SECRET header
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  console.log('[Cron] Starting scheduled tasks...');

  const results = {
    invoiceReminders: { sent: 0, error: null as string | null },
    paymentReminders: { dueSoon: 0, overdue: 0, final: 0, error: null as string | null },
    reviewFollowUps: { sent: 0, error: null as string | null },
    completedJobsProcessed: { created: 0, sent: 0, error: null as string | null },
    inventoryAlerts: { sent: 0, error: null as string | null },
    recurringJobs: { generated: 0, error: null as string | null },
    followUps: { processed: 0, sent: 0, error: null as string | null },
    timestamp: new Date().toISOString(),
  };

  // 1. Send invoice reminders for overdue invoices (legacy)
  try {
    const reminderResult = await invoicingService.sendReminders();
    results.invoiceReminders.sent = reminderResult.sent;
    console.log(`[Cron] Sent ${reminderResult.sent} invoice reminders`);
  } catch (error: any) {
    console.error('[Cron] Invoice reminders error:', error);
    results.invoiceReminders.error = error.message;
  }

  // 2. Process payment reminders (new automated system)
  try {
    const paymentResult = await paymentRemindersService.processAllReminders();
    results.paymentReminders.dueSoon = paymentResult.dueSoon.filter(r => r.success).length;
    results.paymentReminders.overdue = paymentResult.overdue.filter(r => r.success).length;
    results.paymentReminders.final = paymentResult.final.filter(r => r.success).length;
    console.log(`[Cron] Payment reminders: ${results.paymentReminders.dueSoon} friendly, ${results.paymentReminders.overdue} overdue, ${results.paymentReminders.final} final`);
  } catch (error: any) {
    console.error('[Cron] Payment reminders error:', error);
    results.paymentReminders.error = error.message;
  }

  // 3. Send review follow-ups
  try {
    const followUpResult = await reviewService.sendFollowUps();
    results.reviewFollowUps.sent = followUpResult.sent;
    console.log(`[Cron] Sent ${followUpResult.sent} review follow-ups`);
  } catch (error: any) {
    console.error('[Cron] Review follow-ups error:', error);
    results.reviewFollowUps.error = error.message;
  }

  // 4. Process completed jobs that don't have invoices/reviews yet
  try {
    const processResult = await reviewService.processCompletedJobs();
    results.completedJobsProcessed = {
      created: processResult.created,
      sent: processResult.sent,
      error: null,
    };
    console.log(`[Cron] Processed ${processResult.created} completed jobs`);
  } catch (error: any) {
    console.error('[Cron] Process completed jobs error:', error);
    results.completedJobsProcessed.error = error.message;
  }

  // 5. Process inventory low stock alerts
  try {
    const inventoryResult = await inventoryAlertsService.processAlerts();
    results.inventoryAlerts.sent = inventoryResult.filter(r => r.success).length;
    console.log(`[Cron] Sent ${results.inventoryAlerts.sent} inventory alerts`);
  } catch (error: any) {
    console.error('[Cron] Inventory alerts error:', error);
    results.inventoryAlerts.error = error.message;
  }

  // 6. Process recurring jobs
  try {
    const recurringResult = await recurringJobsService.processDueJobs();
    results.recurringJobs.generated = recurringResult.filter(r => r.success).length;
    console.log(`[Cron] Generated ${results.recurringJobs.generated} recurring jobs`);
  } catch (error: any) {
    console.error('[Cron] Recurring jobs error:', error);
    results.recurringJobs.error = error.message;
  }

  // 7. Process follow-up reminders
  try {
    const followUpResult = await followUpsService.processDueFollowUps();
    results.followUps.processed = followUpResult.processed;
    results.followUps.sent = followUpResult.sent;
    console.log(`[Cron] Processed ${followUpResult.processed} follow-ups, sent ${followUpResult.sent}`);
  } catch (error: any) {
    console.error('[Cron] Follow-ups error:', error);
    results.followUps.error = error.message;
  }

  console.log('[Cron] Scheduled tasks complete');

  return NextResponse.json({
    success: true,
    results,
  });
}

/**
 * POST /api/cron
 * Run specific scheduled task
 */
export async function POST(req: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  const body = await req.json();
  const { task } = body;

  const result: any = { task, success: false };

  switch (task) {
    case 'invoice-reminders':
      const reminderResult = await invoicingService.sendReminders();
      result.sent = reminderResult.sent;
      result.success = true;
      break;

    case 'payment-reminders':
      const paymentResult = await paymentRemindersService.processAllReminders();
      result.dueSoon = paymentResult.dueSoon.filter(r => r.success).length;
      result.overdue = paymentResult.overdue.filter(r => r.success).length;
      result.final = paymentResult.final.filter(r => r.success).length;
      result.success = true;
      break;

    case 'review-follow-ups':
      const followUpResult = await reviewService.sendFollowUps();
      result.sent = followUpResult.sent;
      result.success = true;
      break;

    case 'process-completed':
      const processResult = await reviewService.processCompletedJobs();
      result.created = processResult.created;
      result.sent = processResult.sent;
      result.success = true;
      break;

    case 'inventory-alerts':
      const inventoryResult = await inventoryAlertsService.processAlerts();
      result.sent = inventoryResult.filter(r => r.success).length;
      result.success = true;
      break;

    case 'recurring-jobs':
      const recurringResult = await recurringJobsService.processDueJobs();
      result.generated = recurringResult.filter(r => r.success).length;
      result.success = true;
      break;

    case 'follow-ups':
      const followUpTaskResult = await followUpsService.processDueFollowUps();
      result.processed = followUpTaskResult.processed;
      result.sent = followUpTaskResult.sent;
      result.failed = followUpTaskResult.failed;
      result.success = true;
      break;

    default:
      return NextResponse.json(
        { error: `Unknown task: ${task}` },
        { status: 400 }
      );
  }

  return NextResponse.json(result);
}

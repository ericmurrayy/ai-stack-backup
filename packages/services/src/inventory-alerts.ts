/**
 * Inventory Alerts Service
 * ========================
 * Automated low stock alerts and inventory management
 */

import { createClient } from '@supabase/supabase-js';
import { createEmailService, type EmailConfig } from './email';
import { jarvisBridge } from './jarvis-bridge';

// Initialize Supabase client
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

// Create email service instance lazily
function getEmailService() {
  const config: EmailConfig = {
    provider: (process.env.EMAIL_PROVIDER as 'resend' | 'sendgrid') || 'resend',
    apiKey: process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY,
    from: {
      email: process.env.FROM_EMAIL || 'noreply@murrayfsm.com',
      name: "Murray's Field Service",
    },
  };

  if (!config.apiKey) return null;
  return createEmailService(config);
}

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity_on_hand: number;
  reorder_point: number;
  cost_cents: number;
  supplier?: string;
}

interface AlertResult {
  itemId: string;
  itemName: string;
  currentStock: number;
  reorderPoint: number;
  sentVia: string[];
  success: boolean;
}

export const inventoryAlertsService = {
  /**
   * Get items that are below reorder point
   */
  async getLowStockItems(): Promise<InventoryItem[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('is_active', true)
      .lte('quantity_on_hand', supabase.rpc('get_reorder_point', {})) // Assumes a RPC or we compare in code

    if (error) {
      console.error('[InventoryAlerts] Error fetching low stock items:', error);
      return [];
    }

    // Filter items where quantity is at or below reorder point
    return (data || []).filter(item => item.quantity_on_hand <= item.reorder_point);
  },

  /**
   * Get items that are completely out of stock
   */
  async getOutOfStockItems(): Promise<InventoryItem[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('is_active', true)
      .eq('quantity_on_hand', 0);

    if (error) {
      console.error('[InventoryAlerts] Error fetching out of stock items:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Send low stock alert
   */
  async sendLowStockAlert(item: InventoryItem, recipientEmail?: string, recipientPhone?: string): Promise<AlertResult> {
    const result: AlertResult = {
      itemId: item.id,
      itemName: item.name,
      currentStock: item.quantity_on_hand,
      reorderPoint: item.reorder_point,
      sentVia: [],
      success: false,
    };

    try {
      const isOutOfStock = item.quantity_on_hand === 0;
      const subject = isOutOfStock
        ? `OUT OF STOCK: ${item.name} (SKU: ${item.sku})`
        : `Low Stock Alert: ${item.name} (SKU: ${item.sku})`;

      const message = isOutOfStock
        ? `${item.name} is OUT OF STOCK. Please reorder immediately.`
        : `${item.name} is running low. Current stock: ${item.quantity_on_hand}, Reorder point: ${item.reorder_point}`;

      // Send email alert
      if (recipientEmail) {
        try {
          const emailSvc = getEmailService();
          if (emailSvc) {
            const emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: ${isOutOfStock ? '#DC2626' : '#F59E0B'}; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
                  <h2 style="margin: 0;">${isOutOfStock ? '🚨 OUT OF STOCK' : '⚠️ Low Stock Alert'}</h2>
                </div>
                <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 8px 8px;">
                  <h3 style="margin-top: 0;">${item.name}</h3>
                  <p><strong>SKU:</strong> ${item.sku}</p>
                  <p><strong>Category:</strong> ${item.category || 'Uncategorized'}</p>
                  <p><strong>Current Stock:</strong> ${item.quantity_on_hand}</p>
                  <p><strong>Reorder Point:</strong> ${item.reorder_point}</p>
                  ${item.supplier ? `<p><strong>Supplier:</strong> ${item.supplier}</p>` : ''}
                  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                  <p style="color: #6b7280; font-size: 14px;">
                    This is an automated alert from Murray's Field Service inventory management system.
                  </p>
                </div>
              </div>
            `;

            await emailSvc.send({
              to: recipientEmail,
              subject,
              html: emailHtml,
              text: message,
            });
            result.sentVia.push('email');
          }
        } catch (emailError) {
          console.error('[InventoryAlerts] Email send failed:', emailError);
        }
      }

      // Send SMS/WhatsApp alert
      if (recipientPhone) {
        try {
          const smsMessage = `${isOutOfStock ? '🚨 OUT OF STOCK' : '⚠️ LOW STOCK'}: ${item.name} (${item.sku}) - ${item.quantity_on_hand} remaining, reorder at ${item.reorder_point}. - Murray's FSM`;
          await jarvisBridge.sendWhatsApp(recipientPhone, smsMessage);
          result.sentVia.push('sms');
        } catch (smsError) {
          console.error('[InventoryAlerts] SMS send failed:', smsError);
        }
      }

      // Log the alert
      if (supabase && result.sentVia.length > 0) {
        await supabase.from('inventory_alerts').insert({
          inventory_item_id: item.id,
          alert_type: isOutOfStock ? 'out_of_stock' : 'low_stock',
          quantity_at_alert: item.quantity_on_hand,
          channels: result.sentVia,
          sent_at: new Date().toISOString(),
        });
      }

      result.success = result.sentVia.length > 0;
    } catch (error) {
      console.error('[InventoryAlerts] Error sending alert:', error);
    }

    return result;
  },

  /**
   * Process all pending inventory alerts
   */
  async processAlerts(recipientEmail?: string, recipientPhone?: string): Promise<AlertResult[]> {
    const results: AlertResult[] = [];

    if (!supabase) return results;

    // Get settings for alert recipients
    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'inventory_alert_settings')
      .single();

    const alertEmail = recipientEmail || settings?.value?.email || process.env.ADMIN_EMAIL;
    const alertPhone = recipientPhone || settings?.value?.phone;

    // Get low stock items
    const lowStockItems = await this.getLowStockItems();

    // Check which items haven't had alerts sent recently (within 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentAlerts } = await supabase
      .from('inventory_alerts')
      .select('inventory_item_id')
      .gte('sent_at', oneDayAgo);

    const recentAlertIds = new Set((recentAlerts || []).map(a => a.inventory_item_id));

    // Send alerts for items that haven't been alerted recently
    for (const item of lowStockItems) {
      if (!recentAlertIds.has(item.id)) {
        const result = await this.sendLowStockAlert(item, alertEmail, alertPhone);
        results.push(result);
      }
    }

    console.log(`[InventoryAlerts] Processed ${results.length} alerts, ${results.filter(r => r.success).length} sent`);

    return results;
  },

  /**
   * Get inventory stats
   */
  async getStats() {
    if (!supabase) {
      return {
        totalItems: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        totalValue: 0,
      };
    }

    const { data: items } = await supabase
      .from('inventory_items')
      .select('quantity_on_hand, reorder_point, cost_cents')
      .eq('is_active', true);

    const allItems = items || [];
    const lowStock = allItems.filter(i => i.quantity_on_hand <= i.reorder_point && i.quantity_on_hand > 0);
    const outOfStock = allItems.filter(i => i.quantity_on_hand === 0);
    const totalValue = allItems.reduce((sum, i) => sum + (i.quantity_on_hand * (i.cost_cents || 0)), 0);

    return {
      totalItems: allItems.length,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      totalValue: totalValue / 100, // Convert cents to dollars
    };
  },

  /**
   * Update inventory quantity
   */
  async updateQuantity(itemId: string, newQuantity: number, reason?: string) {
    if (!supabase) return { success: false, error: 'Database not configured' };

    const { data: item, error: fetchError } = await supabase
      .from('inventory_items')
      .select('quantity_on_hand, name')
      .eq('id', itemId)
      .single();

    if (fetchError || !item) {
      return { success: false, error: 'Item not found' };
    }

    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({
        quantity_on_hand: newQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Log the change
    await supabase.from('inventory_history').insert({
      inventory_item_id: itemId,
      previous_quantity: item.quantity_on_hand,
      new_quantity: newQuantity,
      change_amount: newQuantity - item.quantity_on_hand,
      reason: reason || 'Manual adjustment',
      created_at: new Date().toISOString(),
    });

    return { success: true };
  },
};

export default inventoryAlertsService;

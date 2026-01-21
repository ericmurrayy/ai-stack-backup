# Murray's FSM - n8n Workflow Templates

## Overview

Murray's FSM integrates with n8n for powerful workflow automation. This guide provides ready-to-use workflow templates for common FSM automation scenarios.

## Setup

1. Install n8n: `npm install -g n8n` or use Docker
2. Import workflow JSON files into n8n
3. Configure credentials for Murray's FSM API and other services
4. Activate workflows

## Workflow Templates

### 1. New Lead Notification

Sends instant notifications when a new lead is created from the booking widget.

```json
{
  "name": "New Lead Notification",
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300],
      "parameters": {
        "path": "fsm-new-lead",
        "httpMethod": "POST"
      }
    },
    {
      "name": "IF High Priority",
      "type": "n8n-nodes-base.if",
      "position": [450, 300],
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{$json.data.priority}}",
              "operation": "equals",
              "value2": "urgent"
            }
          ]
        }
      }
    },
    {
      "name": "SMS Alert (Urgent)",
      "type": "n8n-nodes-base.twilio",
      "position": [650, 200],
      "parameters": {
        "operation": "send",
        "to": "={{$env.OWNER_PHONE}}",
        "message": "🚨 URGENT LEAD: {{$json.data.customer_name}} - {{$json.data.issue}}. Call: {{$json.data.phone}}"
      }
    },
    {
      "name": "Email Notification",
      "type": "n8n-nodes-base.emailSend",
      "position": [650, 400],
      "parameters": {
        "toEmail": "={{$env.OWNER_EMAIL}}",
        "subject": "New Lead: {{$json.data.customer_name}}",
        "text": "A new lead has been submitted:\n\nCustomer: {{$json.data.customer_name}}\nPhone: {{$json.data.phone}}\nEmail: {{$json.data.email}}\nService: {{$json.data.service_type}}\nIssue: {{$json.data.issue}}\n\nView in dashboard: {{$env.APP_URL}}/jobs/{{$json.data.job_id}}"
      }
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{"node": "IF High Priority", "type": "main", "index": 0}]]
    },
    "IF High Priority": {
      "main": [
        [{"node": "SMS Alert (Urgent)", "type": "main", "index": 0}],
        [{"node": "Email Notification", "type": "main", "index": 0}]
      ]
    }
  }
}
```

### 2. Appointment Reminder Sequence

Sends reminder SMS/emails before scheduled appointments.

```json
{
  "name": "Appointment Reminders",
  "nodes": [
    {
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "position": [250, 300],
      "parameters": {
        "rule": {
          "interval": [{"field": "hours", "hoursInterval": 1}]
        }
      }
    },
    {
      "name": "Get Upcoming Jobs",
      "type": "n8n-nodes-base.httpRequest",
      "position": [450, 300],
      "parameters": {
        "method": "GET",
        "url": "={{$env.API_URL}}/api/v1/jobs",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "qs": {
          "status": "scheduled",
          "from_date": "={{$now.plus(23, 'hours').toISO()}}",
          "to_date": "={{$now.plus(25, 'hours').toISO()}}"
        }
      }
    },
    {
      "name": "Loop Jobs",
      "type": "n8n-nodes-base.splitInBatches",
      "position": [650, 300],
      "parameters": {
        "batchSize": 1
      }
    },
    {
      "name": "Send SMS Reminder",
      "type": "n8n-nodes-base.twilio",
      "position": [850, 200],
      "parameters": {
        "operation": "send",
        "to": "={{$json.customer.phone}}",
        "message": "Hi {{$json.customer.name.split(' ')[0]}}! Reminder: Your {{$json.service_type}} appointment is tomorrow at {{$json.scheduled_start}}. Reply CONFIRM to confirm or call us to reschedule."
      }
    },
    {
      "name": "Send Email Reminder",
      "type": "n8n-nodes-base.emailSend",
      "position": [850, 400],
      "parameters": {
        "toEmail": "={{$json.customer.email}}",
        "subject": "Reminder: Your appointment tomorrow",
        "html": "<h2>Appointment Reminder</h2><p>Hi {{$json.customer.name}},</p><p>This is a friendly reminder about your upcoming appointment:</p><ul><li><strong>Service:</strong> {{$json.title}}</li><li><strong>Date:</strong> {{$json.scheduled_start}}</li><li><strong>Address:</strong> {{$json.location.address1}}, {{$json.location.city}}</li></ul><p>If you need to reschedule, please call us or reply to this email.</p>"
      }
    }
  ]
}
```

### 3. Job Completion & Review Request

Automatically sends review requests after job completion.

```json
{
  "name": "Job Completion Review Request",
  "nodes": [
    {
      "name": "Webhook - Job Completed",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300],
      "parameters": {
        "path": "fsm-job-completed",
        "httpMethod": "POST"
      }
    },
    {
      "name": "Wait 2 Hours",
      "type": "n8n-nodes-base.wait",
      "position": [450, 300],
      "parameters": {
        "amount": 2,
        "unit": "hours"
      }
    },
    {
      "name": "Send Review Request",
      "type": "n8n-nodes-base.emailSend",
      "position": [650, 300],
      "parameters": {
        "toEmail": "={{$json.data.customer.email}}",
        "subject": "How did we do? {{$json.data.business_name}}",
        "html": "<h2>Thank you for choosing {{$json.data.business_name}}!</h2><p>Hi {{$json.data.customer.name}},</p><p>We hope you're happy with your recent service. We'd love to hear your feedback!</p><p><a href='{{$env.APP_URL}}/review/{{$json.data.review_token}}' style='background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;'>Leave a Review</a></p><p>Your feedback helps us improve and helps others find great service.</p><p>Thank you!</p>"
      }
    },
    {
      "name": "Create Review Request Record",
      "type": "n8n-nodes-base.httpRequest",
      "position": [850, 300],
      "parameters": {
        "method": "POST",
        "url": "={{$env.API_URL}}/api/review-requests",
        "body": {
          "job_id": "={{$json.data.job_id}}",
          "customer_id": "={{$json.data.customer.id}}",
          "sent_at": "={{$now.toISO()}}"
        }
      }
    }
  ]
}
```

### 4. Invoice Payment Reminder

Sends payment reminders for overdue invoices.

```json
{
  "name": "Invoice Payment Reminders",
  "nodes": [
    {
      "name": "Daily Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "position": [250, 300],
      "parameters": {
        "rule": {
          "interval": [{"field": "days", "daysInterval": 1}],
          "triggerAtHour": 9
        }
      }
    },
    {
      "name": "Get Overdue Invoices",
      "type": "n8n-nodes-base.httpRequest",
      "position": [450, 300],
      "parameters": {
        "method": "GET",
        "url": "={{$env.API_URL}}/api/v1/invoices",
        "qs": {
          "status": "overdue",
          "days_overdue_min": 3
        }
      }
    },
    {
      "name": "Loop Invoices",
      "type": "n8n-nodes-base.splitInBatches",
      "position": [650, 300]
    },
    {
      "name": "IF 3 Days Overdue",
      "type": "n8n-nodes-base.if",
      "position": [850, 200],
      "parameters": {
        "conditions": {
          "number": [
            {"value1": "={{$json.days_overdue}}", "operation": "equal", "value2": 3}
          ]
        }
      }
    },
    {
      "name": "IF 7 Days Overdue",
      "type": "n8n-nodes-base.if",
      "position": [850, 400],
      "parameters": {
        "conditions": {
          "number": [
            {"value1": "={{$json.days_overdue}}", "operation": "equal", "value2": 7}
          ]
        }
      }
    },
    {
      "name": "Send Friendly Reminder (3 days)",
      "type": "n8n-nodes-base.emailSend",
      "position": [1050, 200],
      "parameters": {
        "toEmail": "={{$json.customer.email}}",
        "subject": "Friendly reminder: Invoice #{{$json.invoice_number}}",
        "html": "<p>Hi {{$json.customer.name}},</p><p>Just a friendly reminder that invoice #{{$json.invoice_number}} for {{$json.amount}} is now 3 days past due.</p><p><a href='{{$env.APP_URL}}/pay/{{$json.payment_link}}'>Pay Now</a></p>"
      }
    },
    {
      "name": "Send Urgent Reminder + SMS (7 days)",
      "type": "n8n-nodes-base.twilio",
      "position": [1050, 400],
      "parameters": {
        "to": "={{$json.customer.phone}}",
        "message": "Urgent: Invoice #{{$json.invoice_number}} ({{$json.amount}}) is 7 days overdue. Please pay at {{$env.APP_URL}}/pay/{{$json.payment_link}} or call us."
      }
    }
  ]
}
```

### 5. Estimate Approval Gate

Creates an approval workflow requiring estimate approval before job scheduling.

```json
{
  "name": "Estimate Approval Gate",
  "nodes": [
    {
      "name": "Webhook - Estimate Created",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300],
      "parameters": {
        "path": "fsm-estimate-created",
        "httpMethod": "POST"
      }
    },
    {
      "name": "Check Amount Threshold",
      "type": "n8n-nodes-base.if",
      "position": [450, 300],
      "parameters": {
        "conditions": {
          "number": [
            {"value1": "={{$json.data.total_cents}}", "operation": "larger", "value2": 100000}
          ]
        }
      }
    },
    {
      "name": "Require Manager Approval",
      "type": "n8n-nodes-base.httpRequest",
      "position": [650, 200],
      "parameters": {
        "method": "POST",
        "url": "={{$env.API_URL}}/api/approvals",
        "body": {
          "type": "estimate",
          "entity_id": "={{$json.data.id}}",
          "required_role": "manager",
          "context": "Estimate over $1,000 requires manager approval"
        }
      }
    },
    {
      "name": "Notify Manager",
      "type": "n8n-nodes-base.slack",
      "position": [850, 200],
      "parameters": {
        "channel": "#approvals",
        "text": "🔔 *Approval Required*\n\nEstimate #{{$json.data.id}} for *{{$json.data.customer.name}}* requires approval.\n\nAmount: ${{$json.data.total_cents / 100}}\nService: {{$json.data.title}}\n\n<{{$env.APP_URL}}/approvals|Review in Dashboard>"
      }
    },
    {
      "name": "Auto-Send to Customer",
      "type": "n8n-nodes-base.emailSend",
      "position": [650, 400],
      "parameters": {
        "toEmail": "={{$json.data.customer.email}}",
        "subject": "Your estimate from {{$env.BUSINESS_NAME}}",
        "html": "<p>Hi {{$json.data.customer.name}},</p><p>Please find attached your estimate for {{$json.data.title}}.</p><p><a href='{{$env.APP_URL}}/portal/{{$json.data.portal_token}}'>View & Approve Estimate</a></p>"
      }
    }
  ]
}
```

### 6. Tech Dispatch with ETA

Dispatches technician and sends customer ETA updates.

```json
{
  "name": "Tech Dispatch with ETA",
  "nodes": [
    {
      "name": "Webhook - Tech Dispatched",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300],
      "parameters": {
        "path": "fsm-tech-dispatched",
        "httpMethod": "POST"
      }
    },
    {
      "name": "Calculate ETA",
      "type": "n8n-nodes-base.httpRequest",
      "position": [450, 300],
      "parameters": {
        "method": "GET",
        "url": "https://maps.googleapis.com/maps/api/distancematrix/json",
        "qs": {
          "origins": "={{$json.data.tech_location.lat}},{{$json.data.tech_location.lng}}",
          "destinations": "={{$json.data.job_location.lat}},{{$json.data.job_location.lng}}",
          "key": "={{$env.GOOGLE_MAPS_KEY}}"
        }
      }
    },
    {
      "name": "Send ETA SMS",
      "type": "n8n-nodes-base.twilio",
      "position": [650, 300],
      "parameters": {
        "to": "={{$json.data.customer.phone}}",
        "message": "Good news! Your technician {{$json.data.tech_name}} is on the way! ETA: {{$json.eta_text}}. You can track their location here: {{$env.APP_URL}}/track/{{$json.data.tracking_token}}"
      }
    },
    {
      "name": "Update Job Status",
      "type": "n8n-nodes-base.httpRequest",
      "position": [850, 300],
      "parameters": {
        "method": "PATCH",
        "url": "={{$env.API_URL}}/api/v1/jobs/{{$json.data.job_id}}",
        "body": {
          "status": "en_route",
          "eta": "={{$json.eta_timestamp}}"
        }
      }
    }
  ]
}
```

## Environment Variables Required

```env
API_URL=https://api.yourdomain.com
APP_URL=https://app.yourdomain.com
BUSINESS_NAME=Your Business Name
OWNER_EMAIL=owner@yourbusiness.com
OWNER_PHONE=+15551234567
GOOGLE_MAPS_KEY=your_google_maps_api_key
```

## Webhook Events to Subscribe

Configure these webhooks in Murray's FSM Settings > Integrations > Webhooks:

| Event | n8n Webhook Path |
|-------|------------------|
| `job.created` | `/webhook/fsm-new-lead` |
| `job.completed` | `/webhook/fsm-job-completed` |
| `estimate.created` | `/webhook/fsm-estimate-created` |
| `technician.dispatched` | `/webhook/fsm-tech-dispatched` |
| `payment.received` | `/webhook/fsm-payment-received` |
| `review.received` | `/webhook/fsm-review-received` |

## Best Practices

1. **Use environment variables** for all URLs and credentials
2. **Add error handling** nodes to catch and log failures
3. **Set up monitoring** to alert on workflow failures
4. **Test thoroughly** in sandbox mode before production
5. **Document custom workflows** for your team
6. **Use workflow versioning** to track changes

## Support

For help with n8n workflows:
- n8n Documentation: https://docs.n8n.io
- Murray's FSM Community: https://community.murraysfsm.com
- Email: support@murraysfsm.com

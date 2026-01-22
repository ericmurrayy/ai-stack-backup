# Murray's FSM API Documentation

## Overview

Murray's FSM provides a RESTful API for integrating with external systems, building custom applications, and automating workflows.

**Base URL:** `https://api.yourdomain.com/api`

## Authentication

All API requests require authentication using an API key. Include your API key in the `Authorization` header:

```bash
curl -H "Authorization: Bearer mfsm_your_api_key_here" \
     https://api.yourdomain.com/api/jobs
```

### Obtaining API Keys

1. Navigate to **Settings > Integrations**
2. Click **Create API Key**
3. Select the appropriate scopes for your use case
4. Store the key securely - it will only be shown once

### API Key Scopes

| Scope | Description |
|-------|-------------|
| `read:jobs` | View jobs and job details |
| `write:jobs` | Create and modify jobs |
| `read:customers` | View customer information |
| `write:customers` | Create and modify customers |
| `read:invoices` | View invoices |
| `write:invoices` | Create and modify invoices |
| `read:estimates` | View estimates |
| `write:estimates` | Create and modify estimates |
| `read:team` | View team members |
| `write:team` | Manage team members |
| `read:analytics` | View analytics and reports |
| `manage:webhooks` | Manage webhook endpoints |
| `manage:settings` | Manage business settings |
| `admin` | Full administrative access |

## Rate Limiting

API requests are rate-limited to prevent abuse:

- **Default:** 100 requests per minute
- **Custom limits:** Available per API key

Rate limit headers are included in every response:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

## Response Format

All responses are JSON with the following structure:

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid/missing API key |
| 403 | Forbidden - Insufficient scopes |
| 404 | Not Found |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |

---

## Jobs API

### List Jobs

```http
GET /api/jobs
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (scheduled, in_progress, completed, etc.) |
| `assigned_to` | uuid | Filter by assigned technician |
| `customer_id` | uuid | Filter by customer |
| `from_date` | date | Jobs scheduled after this date |
| `to_date` | date | Jobs scheduled before this date |
| `limit` | number | Results per page (default: 50, max: 100) |
| `offset` | number | Pagination offset |

**Example Response:**

```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "uuid",
        "title": "Garage Door Spring Replacement",
        "status": "scheduled",
        "scheduled_start": "2024-01-15T09:00:00Z",
        "scheduled_end": "2024-01-15T11:00:00Z",
        "customer": {
          "id": "uuid",
          "name": "John Smith",
          "phone": "+15551234567"
        },
        "location": {
          "address1": "123 Main St",
          "city": "Denver",
          "state": "CO",
          "postal_code": "80202"
        },
        "assigned_to": {
          "id": "uuid",
          "name": "Mike Johnson"
        },
        "total_cents": 35000
      }
    ],
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

### Get Job Details

```http
GET /api/jobs/:id
```

### Create Job

```http
POST /api/jobs
```

**Request Body:**

```json
{
  "title": "Garage Door Spring Replacement",
  "service_type": "repair",
  "customer_id": "uuid",
  "location_id": "uuid",
  "scheduled_start": "2024-01-15T09:00:00Z",
  "scheduled_end": "2024-01-15T11:00:00Z",
  "assigned_to": "uuid",
  "notes": "Customer mentioned loud noise when opening",
  "priority": 1
}
```

### Update Job

```http
PATCH /api/jobs/:id
```

### Update Job Status

```http
POST /api/jobs/:id/status
```

**Request Body:**

```json
{
  "status": "in_progress",
  "notes": "Arrived on site"
}
```

---

## Customers API

### List Customers

```http
GET /api/customers
```

### Get Customer Details

```http
GET /api/customers/:id
```

### Create Customer

```http
POST /api/customers
```

**Request Body:**

```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "phone": "+15551234567",
  "source": "website",
  "locations": [
    {
      "address1": "123 Main St",
      "city": "Denver",
      "state": "CO",
      "postal_code": "80202"
    }
  ]
}
```

### Update Customer

```http
PATCH /api/customers/:id
```

---

## Invoices API

### List Invoices

```http
GET /api/invoices
```

### Get Invoice

```http
GET /api/invoices/:id
```

### Create Invoice

```http
POST /api/invoices/:id
```

### Mark Invoice as Paid

```http
POST /api/invoices/:id/pay
```

**Request Body:**

```json
{
  "payment_method": "card",
  "amount_cents": 35000,
  "transaction_id": "ch_abc123"
}
```

---

## Estimates API

### List Estimates

```http
GET /api/estimates
```

### Create Estimate

```http
POST /api/estimates
```

### Approve Estimate

```http
POST /api/estimates/:id/approve
```

---

## Team API

### List Team Members

```http
GET /api/team
```

### Get Team Member Schedule

```http
GET /api/team/:id/schedule
```

---

## Webhooks

Murray's FSM can send real-time notifications to your endpoints when events occur.

### Available Events

| Category | Events |
|----------|--------|
| Jobs | `job.created`, `job.updated`, `job.completed`, `job.cancelled` |
| Customers | `customer.created`, `customer.updated` |
| Financial | `invoice.created`, `invoice.paid`, `payment.received`, `payment.failed`, `estimate.created`, `estimate.approved`, `estimate.rejected` |
| Scheduling | `appointment.scheduled`, `appointment.rescheduled`, `appointment.cancelled`, `technician.dispatched`, `technician.arrived` |
| Reviews | `review.received` |

### Webhook Payload

```json
{
  "id": "evt_abc123",
  "event": "job.completed",
  "timestamp": "2024-01-15T14:30:00Z",
  "data": {
    "job_id": "uuid",
    "title": "Garage Door Spring Replacement",
    "customer_id": "uuid",
    "completed_at": "2024-01-15T14:30:00Z",
    "total_cents": 35000
  }
}
```

### Webhook Signature Verification

All webhooks include a signature header for verification:

```
X-Webhook-Signature: sha256=abc123...
```

**Verify in Node.js:**

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

### Managing Webhooks via API

```http
# List webhooks
GET /api/webhooks

# Create webhook
POST /api/webhooks
{
  "url": "https://your-server.com/webhook",
  "events": ["job.completed", "invoice.paid"],
  "description": "Production webhook"
}

# Update webhook
PATCH /api/webhooks/:id

# Delete webhook
DELETE /api/webhooks/:id

# Test webhook
POST /api/webhooks/:id/test
```

---

## Plugins API

### List Available Plugins

```http
GET /api/plugins
```

### Install Plugin

```http
POST /api/plugins
{
  "pluginId": "stripe",
  "config": {
    "publishableKey": "pk_live_...",
    "secretKey": "sk_live_..."
  }
}
```

### Update Plugin Config

```http
PATCH /api/plugins/:pluginId
{
  "config": { ... },
  "enabled": true
}
```

### Test Plugin Connection

```http
POST /api/plugins/:pluginId/test
{
  "config": { ... }
}
```

### Uninstall Plugin

```http
DELETE /api/plugins/:pluginId
```

---

## SDKs & Libraries

### JavaScript/TypeScript

```bash
npm install @murray-fsm/sdk
```

```typescript
import { MurrayFSM } from '@murray-fsm/sdk';

const client = new MurrayFSM({
  apiKey: 'mfsm_your_api_key'
});

// List jobs
const jobs = await client.jobs.list({
  status: 'scheduled',
  fromDate: '2024-01-01'
});

// Create a job
const job = await client.jobs.create({
  title: 'Garage Door Repair',
  customerId: 'uuid',
  scheduledStart: new Date()
});
```

### Python

```bash
pip install murray-fsm
```

```python
from murray_fsm import Client

client = Client(api_key='mfsm_your_api_key')

# List jobs
jobs = client.jobs.list(status='scheduled')

# Create a job
job = client.jobs.create(
    title='Garage Door Repair',
    customer_id='uuid',
    scheduled_start=datetime.now()
)
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_API_KEY` | API key is invalid or expired |
| `INSUFFICIENT_SCOPES` | API key lacks required permissions |
| `RATE_LIMITED` | Too many requests |
| `VALIDATION_ERROR` | Request body failed validation |
| `NOT_FOUND` | Resource not found |
| `CONFLICT` | Resource conflict (e.g., duplicate) |
| `INTERNAL_ERROR` | Server error |

---

## Changelog

### v1.0.0 (2024-01)
- Initial API release
- Jobs, Customers, Invoices, Estimates endpoints
- Webhook support
- Plugin management API

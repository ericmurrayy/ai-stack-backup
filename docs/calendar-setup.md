# Calendar Integration Setup - Murray's FSM

This guide covers setting up calendar integrations for Murray's FSM.

## Supported Providers

1. **Google Calendar** (recommended)
2. **Microsoft Outlook / 365**
3. **Apple iCloud Calendar** (via CalDAV)

## Google Calendar Setup

### Step 1: Enable Google Calendar API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Go to **APIs & Services** > **Library**
4. Search for "Google Calendar API"
5. Click **Enable**

### Step 2: Create OAuth2 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth 2.0 Client IDs**
3. Select **Web application**
4. Add authorized redirect URI: `https://your-n8n.com/rest/oauth2-credential/callback`
5. Copy Client ID and Client Secret

### Step 3: Configure in n8n

1. In n8n, go to **Credentials**
2. Click **Add Credential** > **Google Calendar OAuth2 API**
3. Enter Client ID and Client Secret
4. Click **Sign in with Google**
5. Authorize access to your calendar

### Step 4: Get Calendar ID

1. Open [Google Calendar](https://calendar.google.com)
2. Click the three dots next to your calendar
3. Click **Settings and sharing**
4. Scroll to **Integrate calendar**
5. Copy **Calendar ID** (or use `primary` for main calendar)
6. Set as `GOOGLE_CALENDAR_ID` in n8n

## Microsoft Outlook Setup

### Step 1: Register Azure App

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Name: "Murray FSM n8n"
5. Redirect URI: `https://your-n8n.com/rest/oauth2-credential/callback`
6. Click **Register**

### Step 2: Configure Permissions

1. Go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Choose **Delegated permissions**
5. Add:
   - `Calendars.ReadWrite`
   - `offline_access`
6. Click **Grant admin consent**

### Step 3: Create Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Copy the secret value

### Step 4: Configure in n8n

1. In n8n, add **Microsoft Outlook OAuth2 API** credential
2. Enter Application ID and Client Secret
3. Complete OAuth flow

## Apple iCloud Calendar (CalDAV)

iCloud uses CalDAV protocol. You need an app-specific password.

### Step 1: Create App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID
3. Go to **Security** > **App-Specific Passwords**
4. Click **Generate Password**
5. Name it "Murray FSM"
6. Copy the generated password

### Step 2: Configure CalDAV

**CalDAV Server:** `https://caldav.icloud.com`

**Your CalDAV URL:**
```
https://caldav.icloud.com/<user_id>/calendars/<calendar_id>/
```

To find your user ID:
1. Open Calendar.app on Mac
2. Go to **Calendar** > **Accounts**
3. Select your iCloud account
4. Note the account ID

### Step 3: n8n Configuration Options

**Option A: Use HTTP Request Node**

```json
{
  "method": "PUT",
  "url": "https://caldav.icloud.com/{user_id}/calendars/{calendar_id}/{event_id}.ics",
  "auth": {
    "username": "your-apple-id@icloud.com",
    "password": "app-specific-password"
  },
  "body": "BEGIN:VCALENDAR\nVERSION:2.0\n..."
}
```

**Option B: Use CalDAV Community Node**

1. Install the n8n CalDAV community node
2. Configure with:
   - Server: `https://caldav.icloud.com`
   - Username: Your Apple ID email
   - Password: App-specific password

## Multi-Calendar Sync

To sync to multiple calendars:

1. Configure credentials for each provider
2. Modify the **08-calendar-sync** workflow
3. Add parallel branches for each provider:

```
[Prepare Event] --> [Google Calendar]
               --> [Outlook Calendar]
               --> [iCloud CalDAV]
```

4. Each branch should:
   - Create/update the calendar event
   - Record in `calendar_events` table with correct provider

## Event Format

Events are created with:
- **Summary:** `{Job Title} - {Customer Name}`
- **Description:** Customer details, phone, address, service notes
- **Location:** Full address if available
- **Start/End:** From `jobs.scheduled_start` and `jobs.scheduled_end`

## Troubleshooting

### Google: "Access blocked"
- Verify OAuth consent screen is configured
- Ensure test user is added (for unverified apps)
- Check redirect URI matches exactly

### Outlook: "Invalid grant"
- Refresh the OAuth token
- Verify permissions are granted
- Check admin consent if required

### iCloud: "Authentication failed"
- Confirm app-specific password is correct
- Ensure 2FA is enabled on Apple ID
- Verify CalDAV URL format

### Events not syncing
- Check job has `scheduled_start` set
- Verify calendar credentials in n8n
- Review n8n execution logs

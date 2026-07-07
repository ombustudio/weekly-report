/**
 * PDF upload to Slack. Incoming webhooks cannot attach files, so this uses a
 * bot token (files:write) with the external-upload flow:
 *   files.getUploadURLExternal → POST bytes → files.completeUploadExternal
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import type { DeliveryResult } from './slack.js';

const SLACK_API = 'https://slack.com/api';

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  upload_url?: string;
  file_id?: string;
}

export async function uploadPdfToSlack(
  botToken: string,
  channel: string,
  pdfPath: string,
  title: string,
  fetchImpl: typeof fetch = fetch
): Promise<DeliveryResult> {
  try {
    const bytes = readFileSync(pdfPath);
    const filename = basename(pdfPath);

    // 1. Reserve an upload URL
    const ticketResponse = await fetchImpl(`${SLACK_API}/files.getUploadURLExternal`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${botToken}`,
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ filename, length: String(bytes.byteLength) })
    });
    const ticket = (await ticketResponse.json()) as SlackApiResponse;
    if (!ticket.ok || !ticket.upload_url || !ticket.file_id) {
      return { ok: false, detail: `Slack getUploadURLExternal: ${ticket.error ?? 'unknown error'}` };
    }

    // 2. Send the bytes
    const uploadResponse = await fetchImpl(ticket.upload_url, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: bytes
    });
    if (!uploadResponse.ok) {
      return { ok: false, detail: `Slack file upload HTTP ${uploadResponse.status}` };
    }

    // 3. Attach to the channel
    const completeResponse = await fetchImpl(`${SLACK_API}/files.completeUploadExternal`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${botToken}`,
        'content-type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        files: [{ id: ticket.file_id, title }],
        channel_id: channel
      })
    });
    const complete = (await completeResponse.json()) as SlackApiResponse;
    if (!complete.ok) {
      const hints: Record<string, string> = {
        not_in_channel: ' — invite the bot to the channel (/invite @YourApp)',
        channel_not_found: ' — use the channel ID (right-click channel → Copy link → C0XXXXXXX), not its name',
        invalid_auth: ' — check slack-bot-token',
        missing_scope: " — the bot token needs the files:write scope"
      };
      return {
        ok: false,
        detail: `Slack completeUploadExternal: ${complete.error}${hints[complete.error ?? ''] ?? ''}`
      };
    }
    return { ok: true, detail: 'ok (PDF uploaded)' };
  } catch (error) {
    return { ok: false, detail: `Slack PDF upload error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

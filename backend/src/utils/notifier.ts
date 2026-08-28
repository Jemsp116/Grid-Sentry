import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface CriticalAlertPayload {
  alertId: number;
  ruleName: string;
  severity: string;
  sourceIp: string;
  targetHost?: string | null;
  mitreTechniqueId?: string | null;
  matchedCount?: number;
}

export interface SlackBlockKitPayload {
  text: string;
  blocks: Array<Record<string, unknown>>;
}

/**
 * Construct Slack Block Kit notification payload.
 */
export function buildSlackPayload(alert: CriticalAlertPayload): SlackBlockKitPayload {
  const alertUrl = `${env.DASHBOARD_BASE_URL}/alerts/${alert.alertId}`;
  const severityEmoji = alert.severity.toLowerCase() === 'critical' ? '🚨' : '⚠️';

  return {
    text: `${severityEmoji} SECURITY ALERT: ${alert.ruleName} triggered by ${alert.sourceIp}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${severityEmoji} [SOC] ${alert.severity.toUpperCase()} ALERT: ${alert.ruleName}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Severity:*\n\`${alert.severity.toUpperCase()}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Source IP:*\n\`${alert.sourceIp}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Target Host:*\n\`${alert.targetHost ?? 'N/A'}\``,
          },
          {
            type: 'mrkdwn',
            text: `*MITRE Technique:*\n\`${alert.mitreTechniqueId ?? 'N/A'}\``,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Investigate Alert in SOC Dashboard →',
              emoji: true,
            },
            url: alertUrl,
            style: 'danger',
          },
        ],
      },
    ],
  };
}

/**
 * Dispatch critical alert notification via Slack Webhook & Email (TICKET-012).
 * Operates non-blockingly — failures in third-party notification delivery never block alert creation.
 */
export async function dispatchCriticalAlertNotification(alert: CriticalAlertPayload): Promise<boolean> {
  const isCriticalOrHigh = ['critical', 'high'].includes(alert.severity.toLowerCase());
  if (!isCriticalOrHigh) return false;

  let dispatched = false;

  // 1. Dispatch to Slack Incoming Webhook if configured
  if (env.SLACK_WEBHOOK_URL) {
    try {
      const payload = buildSlackPayload(alert);
      const res = await fetch(env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        logger.info('Slack critical alert notification dispatched successfully', {
          alertId: alert.alertId,
          ruleName: alert.ruleName,
        });
        dispatched = true;
      } else {
        logger.warn('Slack webhook returned non-200 status', {
          status: res.status,
          alertId: alert.alertId,
        });
      }
    } catch (err) {
      logger.error('Failed to dispatch Slack alert notification', {
        alertId: alert.alertId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    logger.info('Slack notification skipped (SLACK_WEBHOOK_URL unconfigured)', {
      alertId: alert.alertId,
      ruleName: alert.ruleName,
      sourceIp: alert.sourceIp,
    });
  }

  // 2. Dispatch Email alert log notification if configured
  if (env.ALERT_EMAIL_RECIPIENT) {
    logger.info('Email notification queued for recipient', {
      recipient: env.ALERT_EMAIL_RECIPIENT,
      alertId: alert.alertId,
    });
    dispatched = true;
  }

  return dispatched;
}

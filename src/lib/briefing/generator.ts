/**
 * Daily Briefing Generator
 *
 * Compiles yesterday's metrics, agent actions, and recommendations
 * into a morning briefing for operators.
 *
 * Runs daily at 6am via cron.
 */

import { createServerClient } from '@/lib/db/client';
import { sendEmail } from '@/lib/comms/email';
import { sendSMS } from '@/lib/comms/sms';
import Anthropic from '@anthropic-ai/sdk';

interface BriefingMetrics {
  cars_washed: number;
  revenue_cents: number;
  members_saved: number;
  members_lost: number;
  new_members: number;
  active_members: number;
  at_risk_members: number;
}

interface ActionSummary {
  agent: string;
  action_type: string;
  count: number;
  success_count: number;
}

interface Recommendation {
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action_url?: string;
}

interface DailyBriefing {
  site_id: string;
  site_name: string;
  briefing_date: string;
  metrics: BriefingMetrics;
  actions_summary: ActionSummary[];
  recommendations: Recommendation[];
  weather_forecast: WeatherData;
  briefing_text: string;
}

interface WeatherData {
  description: string;
  temp_f: number | null;
  good_for_washing: boolean;
}

/**
 * Generate a daily briefing for a site.
 */
export async function generateBriefing(siteId: string): Promise<DailyBriefing> {
  const supabase = createServerClient();

  // Get site info
  const { data: site } = await supabase
    .from('sites')
    .select('*, organizations(*)')
    .eq('id', siteId)
    .single();

  if (!site) {
    throw new Error('Site not found');
  }

  // Date range: yesterday
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayStart = yesterday.toISOString();
  const yesterdayEnd = today.toISOString();

  // Get yesterday's washes
  const { data: washes } = await supabase
    .from('washes')
    .select('amount_cents, payment_method')
    .eq('site_id', siteId)
    .gte('washed_at', yesterdayStart)
    .lt('washed_at', yesterdayEnd);

  const carsWashed = washes?.length || 0;
  const revenueCents = washes?.reduce((sum, w) => sum + (w.amount_cents || 0), 0) || 0;

  // Get member changes
  const { data: newMembers } = await supabase
    .from('members')
    .select('id')
    .eq('site_id', siteId)
    .gte('created_at', yesterdayStart)
    .lt('created_at', yesterdayEnd);

  const { data: lostMembers } = await supabase
    .from('members')
    .select('id')
    .eq('site_id', siteId)
    .eq('plan_status', 'cancelled')
    .gte('updated_at', yesterdayStart)
    .lt('updated_at', yesterdayEnd);

  // Get current member counts
  const { data: activeMembers } = await supabase
    .from('members')
    .select('id, churn_score')
    .eq('site_id', siteId)
    .eq('plan_status', 'active');

  const activeMemberCount = activeMembers?.length || 0;
  const atRiskCount = activeMembers?.filter((m) => m.churn_score >= 60).length || 0;

  // Get yesterday's agent actions
  const { data: actions } = await supabase
    .from('agent_actions')
    .select('agent, action_type, status')
    .eq('site_id', siteId)
    .gte('created_at', yesterdayStart)
    .lt('created_at', yesterdayEnd);

  // Aggregate actions by type
  const actionMap = new Map<string, { count: number; success: number }>();
  actions?.forEach((a) => {
    const key = `${a.agent}:${a.action_type}`;
    const existing = actionMap.get(key) || { count: 0, success: 0 };
    existing.count++;
    if (a.status === 'executed') existing.success++;
    actionMap.set(key, existing);
  });

  const actionsSummary: ActionSummary[] = Array.from(actionMap.entries()).map(([key, val]) => {
    const [agent, action_type] = key.split(':');
    return {
      agent,
      action_type,
      count: val.count,
      success_count: val.success,
    };
  });

  // Members saved = churn_winback actions that executed
  const membersSaved = actions?.filter(
    (a) => a.action_type === 'churn_winback' && a.status === 'executed'
  ).length || 0;

  // Generate recommendations
  const recommendations: Recommendation[] = [];

  // High churn alert
  if (atRiskCount > activeMemberCount * 0.2) {
    recommendations.push({
      type: 'churn_alert',
      priority: 'high',
      title: 'High Churn Risk',
      description: `${atRiskCount} members (${Math.round((atRiskCount / activeMemberCount) * 100)}%) are at risk of churning. Consider reviewing intervention templates or running a manual outreach campaign.`,
    });
  }

  // No washes alert
  if (carsWashed === 0 && yesterday.getDay() !== 0) {
    // Not Sunday
    recommendations.push({
      type: 'no_activity',
      priority: 'medium',
      title: 'No Washes Recorded',
      description: 'No wash transactions were recorded yesterday. This could indicate a POS sync issue.',
    });
  }

  // Celebrate wins
  if (membersSaved >= 5) {
    recommendations.push({
      type: 'celebration',
      priority: 'low',
      title: `🎉 ${membersSaved} Members Saved!`,
      description: 'Great day! The AI saved multiple members from churning yesterday.',
    });
  }

  // New member opportunity
  if ((newMembers?.length || 0) === 0 && carsWashed > 50) {
    recommendations.push({
      type: 'conversion_opportunity',
      priority: 'medium',
      title: 'Retail Conversion Opportunity',
      description: `${carsWashed} cars washed but no new members. Consider running a signup promotion.`,
    });
  }

  const metrics: BriefingMetrics = {
    cars_washed: carsWashed,
    revenue_cents: revenueCents,
    members_saved: membersSaved,
    members_lost: lostMembers?.length || 0,
    new_members: newMembers?.length || 0,
    active_members: activeMemberCount,
    at_risk_members: atRiskCount,
  };

  const briefing: DailyBriefing = {
    site_id: siteId,
    site_name: site.name,
    briefing_date: yesterday.toISOString().split('T')[0],
    metrics,
    actions_summary: actionsSummary,
    recommendations,
    weather_forecast: await fetchWeather(site.city, site.state),
    briefing_text: '',
  };

  // Generate natural language briefing using Claude
  briefing.briefing_text = await generateBriefingText(briefing);

  return briefing;
}

/**
 * Fetch weather data using Open-Meteo (free, no API key)
 */
async function fetchWeather(city?: string, state?: string): Promise<WeatherData> {
  if (!city) {
    return { description: 'Weather unavailable', temp_f: null, good_for_washing: true };
  }

  try {
    // Geocode the city
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&country=US`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();

    if (!geoData.results?.[0]) {
      return { description: 'Location not found', temp_f: null, good_for_washing: true };
    }

    const { latitude, longitude } = geoData.results[0];

    // Get weather forecast
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;
    const weatherRes = await fetch(weatherUrl);
    const weatherData = await weatherRes.json();

    const temp = weatherData.current?.temperature_2m;
    const code = weatherData.current?.weather_code || 0;

    // Weather code descriptions
    const descriptions: Record<number, string> = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Foggy', 51: 'Light drizzle', 61: 'Light rain', 63: 'Moderate rain',
      65: 'Heavy rain', 71: 'Light snow', 80: 'Rain showers', 95: 'Thunderstorm',
    };

    // Rain codes are bad for car washing
    const badWeatherCodes = [51, 61, 63, 65, 71, 80, 95];
    const goodForWashing = !badWeatherCodes.includes(code);

    return {
      description: descriptions[code] || 'Unknown',
      temp_f: Math.round(temp),
      good_for_washing: goodForWashing,
    };
  } catch (error) {
    console.error('Weather fetch error:', error);
    return { description: 'Weather unavailable', temp_f: null, good_for_washing: true };
  }
}

/**
 * Generate natural language briefing using Claude API
 */
async function generateBriefingText(briefing: DailyBriefing): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Fallback to template-based briefing
    return generateFallbackBriefing(briefing);
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const prompt = `You are the AI briefing assistant for GhostWash, a car wash membership management platform. Write a concise, friendly 2-3 sentence morning briefing for a car wash operator.

Site: ${briefing.site_name}
Date: ${briefing.briefing_date}

Yesterday's Metrics:
- Cars washed: ${briefing.metrics.cars_washed}
- Revenue: $${(briefing.metrics.revenue_cents / 100).toFixed(0)}
- Active members: ${briefing.metrics.active_members}
- At-risk members: ${briefing.metrics.at_risk_members}
- New members: ${briefing.metrics.new_members}
- Members saved by AI: ${briefing.metrics.members_saved}
- Members lost: ${briefing.metrics.members_lost}

Today's Weather: ${briefing.weather_forecast.temp_f ? `${briefing.weather_forecast.temp_f}°F, ${briefing.weather_forecast.description}` : 'Unavailable'}
Good for washing: ${briefing.weather_forecast.good_for_washing ? 'Yes' : 'No (rain expected)'}

Agent Actions Yesterday:
${briefing.actions_summary.map(a => `- ${a.action_type}: ${a.success_count}/${a.count} successful`).join('\n') || '- No actions'}

Write the briefing:
1. Start with "Good morning."
2. Summarize key metrics naturally (don't list all, pick the most important)
3. Mention any wins (members saved, revenue recovered)
4. Include weather if relevant
5. End with "No action needed." if everything looks good, or a brief recommendation if there are concerns`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0];
    if (text.type === 'text') {
      return text.text.trim();
    }

    return generateFallbackBriefing(briefing);
  } catch (error) {
    console.error('Claude API error:', error);
    return generateFallbackBriefing(briefing);
  }
}

/**
 * Fallback template-based briefing when Claude API is unavailable
 */
function generateFallbackBriefing(briefing: DailyBriefing): string {
  const revenue = (briefing.metrics.revenue_cents / 100).toFixed(0);
  const m = briefing.metrics;

  let text = `Good morning. Yesterday at ${briefing.site_name}: ${m.cars_washed} cars, $${revenue} revenue.`;

  if (m.members_saved > 0) {
    text += ` GhostWash saved ${m.members_saved} member${m.members_saved !== 1 ? 's' : ''} from churning.`;
  }

  if (m.new_members > 0) {
    text += ` ${m.new_members} new member${m.new_members !== 1 ? 's' : ''} joined.`;
  }

  if (briefing.weather_forecast.temp_f) {
    text += ` Today: ${briefing.weather_forecast.description}, ${briefing.weather_forecast.temp_f}°F.`;
    if (!briefing.weather_forecast.good_for_washing) {
      text += ' Rain expected — lighter traffic likely.';
    }
  }

  if (m.at_risk_members > 5) {
    text += ` Watch: ${m.at_risk_members} members at risk.`;
  } else {
    text += ' No action needed.';
  }

  return text;
}

/**
 * Save briefing to database.
 */
export async function saveBriefing(briefing: DailyBriefing): Promise<string> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('daily_briefings')
    .upsert(
      {
        site_id: briefing.site_id,
        briefing_date: briefing.briefing_date,
        metrics: briefing.metrics,
        actions_summary: briefing.actions_summary,
        recommendations: briefing.recommendations,
        weather_forecast: briefing.weather_forecast,
        briefing_text: briefing.briefing_text,
      },
      { onConflict: 'site_id,briefing_date' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save briefing: ${error.message}`);
  }

  return data.id;
}

/**
 * Format briefing as email HTML.
 */
export function formatBriefingEmail(briefing: DailyBriefing): { subject: string; body: string } {
  const date = new Date(briefing.briefing_date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const revenue = (briefing.metrics.revenue_cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  const subject = `📊 ${briefing.site_name} Daily Briefing — ${date}`;

  const recommendationsHtml = briefing.recommendations.length > 0
    ? briefing.recommendations
        .map(
          (r) => `
      <div style="padding: 12px; background: ${
        r.priority === 'high' ? '#FEE2E2' : r.priority === 'medium' ? '#FEF3C7' : '#ECFDF5'
      }; border-radius: 8px; margin-bottom: 8px;">
        <strong>${r.title}</strong><br/>
        <span style="color: #666;">${r.description}</span>
      </div>
    `
        )
        .join('')
    : '<p style="color: #666;">No recommendations today. Keep up the great work!</p>';

  const actionsHtml = briefing.actions_summary.length > 0
    ? `<ul style="margin: 0; padding-left: 20px;">
        ${briefing.actions_summary
          .map(
            (a) =>
              `<li>${a.action_type.replace(/_/g, ' ')} — ${a.success_count}/${a.count} successful</li>`
          )
          .join('')}
      </ul>`
    : '<p style="color: #666;">No agent actions yesterday.</p>';

  const body = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: #06101A; color: white; padding: 24px; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">Good Morning! ☀️</h1>
    <p style="margin: 8px 0 0; opacity: 0.8;">${briefing.site_name} — ${date}</p>
  </div>

  <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px;">
    <!-- Key Metrics -->
    <h2 style="margin: 0 0 16px; font-size: 18px; color: #333;">Yesterday's Numbers</h2>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px;">
      <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #0369a1;">${briefing.metrics.cars_washed}</div>
        <div style="color: #666; font-size: 14px;">Cars Washed</div>
      </div>
      <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #15803d;">${revenue}</div>
        <div style="color: #666; font-size: 14px;">Revenue</div>
      </div>
      <div style="background: #fef3c7; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #b45309;">${briefing.metrics.members_saved}</div>
        <div style="color: #666; font-size: 14px;">Members Saved</div>
      </div>
      <div style="background: #fce7f3; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #be185d;">${briefing.metrics.new_members}</div>
        <div style="color: #666; font-size: 14px;">New Members</div>
      </div>
    </div>

    <!-- Membership Health -->
    <h2 style="margin: 0 0 16px; font-size: 18px; color: #333;">Membership Health</h2>
    <p style="margin: 0 0 24px; color: #666;">
      <strong>${briefing.metrics.active_members}</strong> active members •
      <strong style="color: ${briefing.metrics.at_risk_members > 10 ? '#dc2626' : '#666'};">${briefing.metrics.at_risk_members}</strong> at risk •
      <strong style="color: #dc2626;">${briefing.metrics.members_lost}</strong> lost yesterday
    </p>

    <!-- Agent Actions -->
    <h2 style="margin: 0 0 16px; font-size: 18px; color: #333;">🤖 Agent Actions</h2>
    ${actionsHtml}

    <!-- Recommendations -->
    <h2 style="margin: 24px 0 16px; font-size: 18px; color: #333;">📋 Recommendations</h2>
    ${recommendationsHtml}

    <!-- Footer -->
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/${briefing.site_id}" style="display: inline-block; background: #E8A000; color: #06101A; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Dashboard</a>
      <p style="margin: 16px 0 0; color: #999; font-size: 12px;">
        Sent by GhostWash • Your AI is working 24/7
      </p>
    </div>
  </div>
</body>
</html>
`;

  return { subject, body };
}

/**
 * Format briefing as SMS summary.
 */
export function formatBriefingSMS(briefing: DailyBriefing): string {
  const revenue = (briefing.metrics.revenue_cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  return `📊 ${briefing.site_name} Daily
${briefing.metrics.cars_washed} cars | ${revenue}
${briefing.metrics.members_saved} saved | ${briefing.metrics.at_risk_members} at risk
${briefing.recommendations.length > 0 ? `⚠️ ${briefing.recommendations[0].title}` : '✅ All good!'}`;
}

/**
 * Send briefing to operator.
 */
export async function sendBriefing(
  briefing: DailyBriefing,
  email: string,
  phone?: string
): Promise<{ email_sent: boolean; sms_sent: boolean }> {
  const { subject, body } = formatBriefingEmail(briefing);
  const smsBody = formatBriefingSMS(briefing);

  const emailResult = await sendEmail(email, subject, body);
  const smsResult = phone ? await sendSMS(phone, smsBody) : { success: false };

  // Update briefing sent_at
  const supabase = createServerClient();
  await supabase
    .from('daily_briefings')
    .update({ sent_at: new Date().toISOString() })
    .eq('site_id', briefing.site_id)
    .eq('briefing_date', briefing.briefing_date);

  return {
    email_sent: emailResult.success,
    sms_sent: smsResult.success,
  };
}

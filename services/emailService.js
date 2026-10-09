// Sends the order confirmation email with Nodemailer.
// Possible result statuses:
//   SENT           - the SMTP server accepted the email
//   PREVIEW_LOGGED - (development only) SMTP is not configured; a preview was printed to the server console, NO real email was sent
//   NOT_CONFIGURED - (production) SMTP is not configured, nothing was sent
//   FAILED         - SMTP is configured but sending failed
const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

const isConfigured = () => Boolean(config.smtp.host);

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporter;
}

const money = (n) => `Rs. ${Number(n).toLocaleString('en-IN')}`;
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function buildEmail(order) {
  const subject = `FoodExpress order ${order.id} - BOOKED`;

  const textLines = order.items.map((i) => `  - ${i.name} x ${i.quantity}  @ ${money(i.unitPrice)} = ${money(i.lineTotal)}`);
  const text = [
    `Hi ${order.customer.name},`,
    '',
    'Thank you for ordering with FoodExpress! Your order has been booked.',
    '',
    `Order ID: ${order.id}`,
    'Status:   BOOKED',
    '',
    'Items:',
    ...textLines,
    '',
    `Total: ${money(order.total)}`,
    '',
    `Delivery address: ${order.customer.address}`,
    '',
    'This is a demo order - no payment has been collected.',
    'Enjoy your meal!',
    '- The FoodExpress Team',
  ].join('\n');

  const rows = order.items.map((i) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(i.name)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${money(i.unitPrice)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${money(i.lineTotal)}</td>
      </tr>`).join('');

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#222">
    <h1 style="color:#f97316;margin-bottom:4px">FoodExpress</h1>
    <p>Hi ${escapeHtml(order.customer.name)},</p>
    <p>Thank you for ordering with FoodExpress! Your delicious food is on its way to being prepared.</p>
    <p><strong>Order ID:</strong> ${escapeHtml(order.id)}<br><strong>Status:</strong> BOOKED</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr style="background:#fff7ed">
        <th style="padding:8px;text-align:left">Item</th><th style="padding:8px">Qty</th>
        <th style="padding:8px;text-align:right">Price</th><th style="padding:8px;text-align:right">Subtotal</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3" style="padding:8px;text-align:right"><strong>Total</strong></td>
        <td style="padding:8px;text-align:right"><strong>${money(order.total)}</strong></td></tr></tfoot>
    </table>
    <p><strong>Delivery address:</strong><br>${escapeHtml(order.customer.address)}</p>
    <p style="font-size:12px;color:#777">This is a demo order - no payment has been collected.</p>
  </div>`;

  return { subject, text, html };
}

async function sendOrderConfirmation(order) {
  const mail = buildEmail(order);

  if (!isConfigured()) {
    if (config.isProduction) {
      console.warn(`[email] SMTP is not configured; confirmation for ${order.id} was not sent.`);
      return { status: 'NOT_CONFIGURED' };
    }
    console.log([
      '',
      '================ EMAIL PREVIEW (development mode) ================',
      'SMTP is not configured, so NO REAL EMAIL WAS SENT. This is only a preview.',
      `From:    ${config.emailFrom}`,
      `To:      ${order.customer.email}`,
      `Subject: ${mail.subject}`,
      '------------------------------------------------------------------',
      mail.text,
      '===================================================================',
      '',
    ].join('\n'));
    return { status: 'PREVIEW_LOGGED' };
  }

  try {
    await getTransporter().sendMail({
      from: config.emailFrom,
      to: order.customer.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return { status: 'SENT' };
  } catch (err) {
    // Log only a short reason - never the credentials or the full error object.
    console.error(`[email] Failed to send confirmation for ${order.id}: ${err.code || err.name}: ${err.message}`);
    return { status: 'FAILED' };
  }
}

module.exports = { sendOrderConfirmation, buildEmail, isConfigured };

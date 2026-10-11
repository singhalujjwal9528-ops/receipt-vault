const cron = require("node-cron");
const prisma = require("../db");
const { sendMail } = require("./mailer");

async function sendExpiryAlerts() {
  const now = new Date();
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(now.getDate() + 3);

  try {
    // Find warranties expiring in <= 3 days not notified yet
    const expiringWarranties = await prisma.receipt.findMany({
      where: {
        warrantyExpiresAt: { lte: threeDaysFromNow, gte: now },
        warrantyReminderSent: false,
      },
      include: { user: true },
    });

    for (const r of expiringWarranties) {
      if (r.user?.email) {
        await sendMail({
          to: r.user.email,
          subject: `⚠️ Warranty Expiring Soon: ${r.vendor}`,
          html: `<p>Hi ${r.user.name || "there"},</p>
                 <p>Your warranty for <strong>${r.vendor}</strong> (${r.itemDescription || "Purchased item"}) expires on <strong>${new Date(r.warrantyExpiresAt).toLocaleDateString()}</strong>.</p>`,
        });

        await prisma.receipt.update({
          where: { id: r.id },
          data: { warrantyReminderSent: true },
        });
      }
    }

    // Find returns expiring in <= 3 days not notified yet
    const expiringReturns = await prisma.receipt.findMany({
      where: {
        returnExpiresAt: { lte: threeDaysFromNow, gte: now },
        returnReminderSent: false,
      },
      include: { user: true },
    });

    for (const r of expiringReturns) {
      if (r.user?.email) {
        await sendMail({
          to: r.user.email,
          subject: `⚠️ Return Window Closing Soon: ${r.vendor}`,
          html: `<p>Hi ${r.user.name || "there"},</p>
                 <p>Your return window for <strong>${r.vendor}</strong> (${r.itemDescription || "Purchased item"}) ends on <strong>${new Date(r.returnExpiresAt).toLocaleDateString()}</strong>.</p>`,
        });

        await prisma.receipt.update({
          where: { id: r.id },
          data: { returnReminderSent: true },
        });
      }
    }
  } catch (err) {
    console.error("[scheduler] Error running expiry check:", err);
  }
}

function startScheduler() {
  console.log("[scheduler] Daily deadline check scheduled for 08:00 AM");
  cron.schedule("0 8 * * *", sendExpiryAlerts);
}

module.exports = { startScheduler, sendExpiryAlerts };
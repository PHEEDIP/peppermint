import { prisma } from "../../../prisma";

/**
 * Creates notifications for all admin users when a new ticket is created.
 *
 * @param {object} ticket - The ticket object
 * @returns {Promise<void>}
 */
export async function createTicketNotification(ticket: any) {
  try {
    const text = `New ticket #${ticket.id} created: ${ticket.title}`;

    // Get all admin users
    const admins = await prisma.user.findMany({
      where: { isAdmin: true },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notifications.createMany({
        data: admins.map((admin) => ({
          text,
          userId: admin.id,
          ticketId: ticket.id,
        })),
      });
    }
  } catch (error) {
    console.error("Error creating ticket notifications for admins:", error);
  }
}

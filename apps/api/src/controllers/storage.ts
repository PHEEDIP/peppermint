//@ts-nocheck
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../prisma";
import fs from "fs";
import util from "util";
import { pipeline } from "stream";
import path from "path";
const pump = util.promisify(pipeline);

export function objectStoreRoutes(fastify: FastifyInstance) {
  //
  fastify.post(
    "/api/v1/storage/ticket/:id/upload/single",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = await request.file();
      
      if (!data) {
        return reply.status(400).send({ success: false, message: "No file uploaded" });
      }

      if (!fs.existsSync("uploads/")) {
        fs.mkdirSync("uploads/", { recursive: true });
      }

      const destFilename = `${Date.now()}-${data.filename}`;
      const destPath = path.join("uploads", destFilename);
      
      await pump(data.file, fs.createWriteStream(destPath));
      const stats = fs.statSync(destPath);
      
      const userId = data.fields.user ? data.fields.user.value : undefined;

      const uploadedFile = await prisma.ticketFile.create({
        data: {
          ticketId: request.params.id,
          filename: data.filename,
          path: destPath,
          mime: data.mimetype,
          size: stats.size,
          encoding: data.encoding,
          userId: userId,
        },
      });

      console.log(uploadedFile);

      reply.send({
        success: true,
      });
    }
  );

  // Get all ticket attachments

  // Delete an attachment

  // Download an attachment
}

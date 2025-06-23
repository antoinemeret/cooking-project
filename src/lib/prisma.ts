declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

import { PrismaClient } from '@prisma/client'

export const prisma = globalThis.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
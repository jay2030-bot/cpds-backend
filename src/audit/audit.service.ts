import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildMeta } from '../common/dto/api-result';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(userId: string | null, action: string, entity: string, entityId?: string | null, metadata?: Prisma.InputJsonValue) {
    return this.prisma.auditLog.create({
      data: { userId, action, entity, entityId: entityId ?? null, metadata },
    });
  }

  async findAll(q: QueryAuditLogsDto) {
    const where: Prisma.AuditLogWhereInput = {
      ...(q.entity ? { entity: q.entity } : {}),
      ...(q.action ? { action: q.action } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, meta: buildMeta(q.page, q.limit, total) };
  }
}

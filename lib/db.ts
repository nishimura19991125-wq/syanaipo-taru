/**
 * Airtable data layer — replaces Prisma.
 *
 * Required Airtable tables and field names (all camelCase text/checkbox):
 *   Users         : name, email, password, role, createdAt, updatedAt
 *   Sessions      : userId, token, expiresAt, createdAt
 *   MindMaps      : title, data (long text), isPublic (checkbox), ownerId, createdAt, updatedAt
 *   MindMapShares : mindMapId, userId, permission, createdAt
 *   Announcements : title, content (long text), authorId, pinned (checkbox), createdAt, updatedAt
 *   CalendarEvents: title, description (long text), startAt, endAt, allDay (checkbox),
 *                   color, category, recurrence, userId, createdAt, updatedAt
 *
 * All entity IDs are Airtable native record IDs (recXXXXXXXXXXXX).
 */
import { base, esc } from './airtable'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string | null
  email: string
  password: string
  role: string
  createdAt: string
  updatedAt: string
}

export interface Session {
  id: string
  userId: string
  token: string
  expiresAt: string
  createdAt: string
}

export interface MindMap {
  id: string
  title: string
  data: string
  isPublic: boolean
  ownerId: string
  createdAt: string
  updatedAt: string
}

export interface MindMapShare {
  id: string
  mindMapId: string
  userId: string
  permission: string
  createdAt: string
}

export interface Announcement {
  id: string
  title: string
  content: string
  authorId: string
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export interface CalendarEvent {
  id: string
  title: string
  description: string | null
  startAt: string
  endAt: string | null
  allDay: boolean
  color: string
  category: string
  recurrence: string
  userId: string
  createdAt: string
  updatedAt: string
}

// ─── Record converters ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toUser = (r: any): User => ({
  id: r.id,
  name: r.fields.name ?? null,
  email: r.fields.email ?? '',
  password: r.fields.password ?? '',
  role: r.fields.role ?? 'user',
  createdAt: r.fields.createdAt ?? new Date().toISOString(),
  updatedAt: r.fields.updatedAt ?? new Date().toISOString(),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toSession = (r: any): Session => ({
  id: r.id,
  userId: r.fields.userId ?? '',
  token: r.fields.token ?? '',
  expiresAt: r.fields.expiresAt ?? '',
  createdAt: r.fields.createdAt ?? new Date().toISOString(),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toMindMap = (r: any): MindMap => ({
  id: r.id,
  title: r.fields.title ?? '',
  data: r.fields.data ?? '{}',
  isPublic: r.fields.isPublic ?? false,
  ownerId: r.fields.ownerId ?? '',
  createdAt: r.fields.createdAt ?? new Date().toISOString(),
  updatedAt: r.fields.updatedAt ?? new Date().toISOString(),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toShare = (r: any): MindMapShare => ({
  id: r.id,
  mindMapId: r.fields.mindMapId ?? '',
  userId: r.fields.userId ?? '',
  permission: r.fields.permission ?? 'view',
  createdAt: r.fields.createdAt ?? new Date().toISOString(),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toAnnouncement = (r: any): Announcement => ({
  id: r.id,
  title: r.fields.title ?? '',
  content: r.fields.content ?? '',
  authorId: r.fields.authorId ?? '',
  pinned: r.fields.pinned ?? false,
  createdAt: r.fields.createdAt ?? new Date().toISOString(),
  updatedAt: r.fields.updatedAt ?? new Date().toISOString(),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toCalendarEvent = (r: any): CalendarEvent => ({
  id: r.id,
  title: r.fields.title ?? '',
  description: r.fields.description || null,
  startAt: r.fields.startAt ?? '',
  endAt: r.fields.endAt || null,
  allDay: r.fields.allDay ?? false,
  color: r.fields.color ?? '#4F46E5',
  category: r.fields.category ?? 'other',
  recurrence: r.fields.recurrence ?? 'none',
  userId: r.fields.userId ?? '',
  createdAt: r.fields.createdAt ?? new Date().toISOString(),
  updatedAt: r.fields.updatedAt ?? new Date().toISOString(),
})

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = {
  async findByEmail(email: string): Promise<User | null> {
    const rows = await base('Users').select({
      filterByFormula: `{email} = "${esc(email)}"`,
      maxRecords: 1,
    }).firstPage()
    return rows.length > 0 ? toUser(rows[0]) : null
  },

  async findById(id: string): Promise<User | null> {
    try {
      return toUser(await base('Users').find(id))
    } catch {
      return null
    }
  },

  async findManyByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return []
    const results = await Promise.all(ids.map((id) => users.findById(id)))
    return results.filter((u): u is User => u !== null)
  },

  async findAll(): Promise<User[]> {
    const rows = await base('Users').select({
      sort: [{ field: 'name', direction: 'asc' }],
    }).all()
    return rows.map(toUser)
  },

  async count(): Promise<number> {
    const rows = await base('Users').select({ fields: ['email'] }).all()
    return rows.length
  },

  async create(data: { name: string; email: string; password: string; role: string }): Promise<User> {
    const now = new Date().toISOString()
    const row = await base('Users').create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
      createdAt: now,
      updatedAt: now,
    })
    return toUser(row)
  },
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const sessions = {
  async findByToken(token: string): Promise<Session | null> {
    const rows = await base('Sessions').select({
      filterByFormula: `{token} = "${esc(token)}"`,
      maxRecords: 1,
    }).firstPage()
    return rows.length > 0 ? toSession(rows[0]) : null
  },

  async create(data: { userId: string; token: string; expiresAt: Date }): Promise<Session> {
    const row = await base('Sessions').create({
      userId: data.userId,
      token: data.token,
      expiresAt: data.expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    })
    return toSession(row)
  },

  async deleteByToken(token: string): Promise<void> {
    const rows = await base('Sessions').select({
      filterByFormula: `{token} = "${esc(token)}"`,
      maxRecords: 1,
    }).firstPage()
    if (rows.length > 0) await base('Sessions').destroy(rows[0].id)
  },
}

// ─── MindMaps ─────────────────────────────────────────────────────────────────

export const mindMaps = {
  async findById(id: string): Promise<MindMap | null> {
    try {
      return toMindMap(await base('MindMaps').find(id))
    } catch {
      return null
    }
  },

  async findManyByIds(ids: string[]): Promise<MindMap[]> {
    if (ids.length === 0) return []
    const results = await Promise.all(ids.map((id) => mindMaps.findById(id)))
    return results.filter((m): m is MindMap => m !== null)
  },

  async findByOwner(ownerId: string): Promise<MindMap[]> {
    const rows = await base('MindMaps').select({
      filterByFormula: `{ownerId} = "${esc(ownerId)}"`,
      sort: [{ field: 'updatedAt', direction: 'desc' }],
    }).all()
    return rows.map(toMindMap)
  },

  async create(data: { title: string; data: string; ownerId: string }): Promise<MindMap> {
    const now = new Date().toISOString()
    const row = await base('MindMaps').create({
      title: data.title,
      data: data.data,
      isPublic: false,
      ownerId: data.ownerId,
      createdAt: now,
      updatedAt: now,
    })
    return toMindMap(row)
  },

  async update(id: string, data: Partial<Pick<MindMap, 'title' | 'data' | 'isPublic'>>): Promise<MindMap> {
    const row = await base('MindMaps').update(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    })
    return toMindMap(row)
  },

  async delete(id: string): Promise<void> {
    await base('MindMaps').destroy(id)
  },
}

// ─── MindMapShares ────────────────────────────────────────────────────────────

export const shares = {
  async findByMindMap(mindMapId: string): Promise<MindMapShare[]> {
    const rows = await base('MindMapShares').select({
      filterByFormula: `{mindMapId} = "${esc(mindMapId)}"`,
    }).all()
    return rows.map(toShare)
  },

  async findByUser(userId: string): Promise<MindMapShare[]> {
    const rows = await base('MindMapShares').select({
      filterByFormula: `{userId} = "${esc(userId)}"`,
    }).all()
    return rows.map(toShare)
  },

  async findByMindMapAndUser(mindMapId: string, userId: string): Promise<MindMapShare | null> {
    const rows = await base('MindMapShares').select({
      filterByFormula: `AND({mindMapId} = "${esc(mindMapId)}", {userId} = "${esc(userId)}")`,
      maxRecords: 1,
    }).firstPage()
    return rows.length > 0 ? toShare(rows[0]) : null
  },

  async upsert(mindMapId: string, userId: string, permission: string): Promise<MindMapShare> {
    const existing = await shares.findByMindMapAndUser(mindMapId, userId)
    if (existing) {
      const row = await base('MindMapShares').update(existing.id, { permission })
      return toShare(row)
    }
    const row = await base('MindMapShares').create({
      mindMapId, userId, permission,
      createdAt: new Date().toISOString(),
    })
    return toShare(row)
  },

  async delete(mindMapId: string, userId: string): Promise<void> {
    const existing = await shares.findByMindMapAndUser(mindMapId, userId)
    if (existing) await base('MindMapShares').destroy(existing.id)
  },
}

// ─── Announcements ────────────────────────────────────────────────────────────

export const announcements = {
  async findAll(): Promise<Announcement[]> {
    const rows = await base('Announcements').select({
      sort: [
        { field: 'pinned', direction: 'desc' },
        { field: 'createdAt', direction: 'desc' },
      ],
    }).all()
    return rows.map(toAnnouncement)
  },

  async create(data: { title: string; content: string; authorId: string; pinned: boolean }): Promise<Announcement> {
    const now = new Date().toISOString()
    const row = await base('Announcements').create({
      title: data.title,
      content: data.content,
      authorId: data.authorId,
      pinned: data.pinned,
      createdAt: now,
      updatedAt: now,
    })
    return toAnnouncement(row)
  },

  async update(id: string, data: { title: string; content: string; pinned: boolean }): Promise<Announcement> {
    const row = await base('Announcements').update(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    })
    return toAnnouncement(row)
  },

  async delete(id: string): Promise<void> {
    await base('Announcements').destroy(id)
  },
}

// ─── CalendarEvents ───────────────────────────────────────────────────────────

export const calendarEvents = {
  async findById(id: string): Promise<CalendarEvent | null> {
    try {
      return toCalendarEvent(await base('CalendarEvents').find(id))
    } catch {
      return null
    }
  },

  async findByUsersInRange(userIds: string[], from: Date, to: Date): Promise<CalendarEvent[]> {
    if (userIds.length === 0) return []
    const userFilter = userIds.length === 1
      ? `{userId} = "${esc(userIds[0])}"`
      : `OR(${userIds.map((id) => `{userId} = "${esc(id)}"`).join(',')})`
    const rows = await base('CalendarEvents').select({
      filterByFormula: userFilter,
      sort: [{ field: 'startAt', direction: 'asc' }],
    }).all()
    // Date filtering done in JS to avoid complex Airtable date formula syntax
    return rows.map(toCalendarEvent).filter((e) => {
      const start = new Date(e.startAt)
      const end = e.endAt ? new Date(e.endAt) : start
      return start <= to && end >= from
    })
  },

  async create(data: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<CalendarEvent> {
    const now = new Date().toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields: Record<string, any> = {
      title: data.title,
      startAt: data.startAt,
      allDay: data.allDay,
      color: data.color,
      category: data.category,
      recurrence: data.recurrence,
      userId: data.userId,
      createdAt: now,
      updatedAt: now,
    }
    if (data.description) fields.description = data.description
    if (data.endAt) fields.endAt = data.endAt
    const row = await base('CalendarEvents').create(fields)
    return toCalendarEvent(row)
  },

  async update(id: string, data: Record<string, unknown>): Promise<CalendarEvent> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields: Record<string, any> = { updatedAt: new Date().toISOString() }
    for (const [k, v] of Object.entries(data)) {
      // Convert null to "" to clear Airtable text fields
      fields[k] = v === null ? '' : v
    }
    const row = await base('CalendarEvents').update(id, fields)
    return toCalendarEvent(row)
  },

  async delete(id: string): Promise<void> {
    await base('CalendarEvents').destroy(id)
  },
}

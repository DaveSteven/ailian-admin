import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const priceTypeEnum = pgEnum('price_type', ['starting', 'range', 'negotiable', 'hourly']);
export const leadStatusEnum = pgEnum('lead_status', ['new', 'contacted', 'closed', 'invalid']);
export const chatRoleEnum = pgEnum('chat_role', ['user', 'assistant', 'system']);
export const merchantReviewStatusEnum = pgEnum('merchant_review_status', ['pending', 'approved', 'rejected']);
export const staffRoleEnum = pgEnum('staff_role', ['field_agent', 'reviewer', 'admin']);

export const staffUsers = pgTable(
  'staff_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    openId: varchar('open_id', { length: 128 }).notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    role: staffRoleEnum('role').notNull().default('field_agent'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    openIdIdx: uniqueIndex('staff_users_open_id_idx').on(table.openId),
  }),
);

export const staffSessions = pgTable(
  'staff_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffUserId: uuid('staff_user_id')
      .notNull()
      .references(() => staffUsers.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenIdx: uniqueIndex('staff_sessions_token_hash_idx').on(table.tokenHash),
    staffIdx: index('staff_sessions_staff_user_idx').on(table.staffUserId),
  }),
);

export const serviceCategories = pgTable(
  'service_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    codeIdx: uniqueIndex('service_categories_code_idx').on(table.code),
  }),
);

export const communities = pgTable(
  'communities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    province: varchar('province', { length: 80 }),
    city: varchar('city', { length: 80 }),
    district: varchar('district', { length: 80 }),
    address: text('address'),
    longitude: decimal('longitude', { precision: 10, scale: 7 }),
    latitude: decimal('latitude', { precision: 10, scale: 7 }),
    geoPoint: text('geo_point'),
    coordinateSystem: varchar('coordinate_system', { length: 16 }).notNull().default('gcj02'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: index('communities_name_idx').on(table.name),
  }),
);

export const merchants = pgTable(
  'merchants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 160 }).notNull(),
    contactName: varchar('contact_name', { length: 80 }),
    phone: varchar('phone', { length: 32 }).notNull(),
    wechatId: varchar('wechat_id', { length: 80 }),
    primaryCategoryId: uuid('primary_category_id').references(() => serviceCategories.id),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    province: varchar('province', { length: 80 }),
    city: varchar('city', { length: 80 }),
    district: varchar('district', { length: 80 }),
    address: text('address'),
    longitude: decimal('longitude', { precision: 10, scale: 7 }),
    latitude: decimal('latitude', { precision: 10, scale: 7 }),
    geoPoint: text('geo_point'),
    serviceRadiusKm: decimal('service_radius_km', { precision: 5, scale: 2 }).notNull().default('3'),
    businessHours: varchar('business_hours', { length: 120 }),
    nightService: boolean('night_service').notNull().default(false),
    verified: boolean('verified').notNull().default(false),
    rating: decimal('rating', { precision: 3, scale: 2 }),
    note: text('note'),
    source: varchar('source', { length: 80 }).notNull().default('manual'),
    reviewStatus: merchantReviewStatusEnum('review_status').notNull().default('pending'),
    createdByStaffId: uuid('created_by_staff_id').references(() => staffUsers.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    phoneIdx: index('merchants_phone_idx').on(table.phone),
    namePhoneIdx: uniqueIndex('merchants_name_phone_idx').on(table.name, table.phone),
    categoryIdx: index('merchants_primary_category_idx').on(table.primaryCategoryId),
  }),
);

export const merchantContacts = pgTable(
  'merchant_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    phone: varchar('phone', { length: 32 }).notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    merchantIdx: index('merchant_contacts_merchant_idx').on(table.merchantId, table.position),
  }),
);

export const merchantMedia = pgTable(
  'merchant_media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    mediaType: varchar('media_type', { length: 24 }).notNull(),
    storageKey: varchar('storage_key', { length: 160 }).notNull(),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    storageKeyIdx: uniqueIndex('merchant_media_storage_key_idx').on(table.storageKey),
    merchantIdx: index('merchant_media_merchant_idx').on(table.merchantId, table.mediaType, table.position),
  }),
);

export const merchantServices = pgTable(
  'merchant_services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => serviceCategories.id),
    name: varchar('name', { length: 160 }).notNull(),
    commonPhrases: text('common_phrases').array().notNull().default(sql`'{}'::text[]`),
    priceType: priceTypeEnum('price_type').notNull().default('negotiable'),
    minPrice: integer('min_price'),
    maxPrice: integer('max_price'),
    priceDescription: text('price_description'),
    emergencyAvailable: boolean('emergency_available').notNull().default(false),
    averageResponseTime: varchar('average_response_time', { length: 80 }),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    merchantIdx: index('merchant_services_merchant_idx').on(table.merchantId),
    categoryIdx: index('merchant_services_category_idx').on(table.categoryId),
    merchantNameIdx: uniqueIndex('merchant_services_merchant_name_idx').on(table.merchantId, table.name),
  }),
);

export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    merchantId: uuid('merchant_id').references(() => merchants.id),
    merchantServiceId: uuid('merchant_service_id').references(() => merchantServices.id),
    userOpenId: varchar('user_open_id', { length: 128 }),
    userMessage: text('user_message').notNull(),
    userPhone: varchar('user_phone', { length: 32 }),
    status: leadStatusEnum('status').notNull().default('new'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    merchantIdx: index('leads_merchant_idx').on(table.merchantId),
    statusIdx: index('leads_status_idx').on(table.status),
  }),
);

export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userOpenId: varchar('user_open_id', { length: 128 }),
  communityId: uuid('community_id').references(() => communities.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    role: chatRoleEnum('role').notNull(),
    content: text('content').notNull(),
    intent: jsonb('intent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index('chat_messages_session_idx').on(table.sessionId),
  }),
);

export const serviceCategoriesRelations = relations(serviceCategories, ({ many }) => ({
  merchants: many(merchants),
  merchantServices: many(merchantServices),
}));

export const merchantsRelations = relations(merchants, ({ one, many }) => ({
  primaryCategory: one(serviceCategories, {
    fields: [merchants.primaryCategoryId],
    references: [serviceCategories.id],
  }),
  services: many(merchantServices),
  contacts: many(merchantContacts),
  media: many(merchantMedia),
}));

export const merchantContactsRelations = relations(merchantContacts, ({ one }) => ({
  merchant: one(merchants, {
    fields: [merchantContacts.merchantId],
    references: [merchants.id],
  }),
}));

export const merchantMediaRelations = relations(merchantMedia, ({ one }) => ({
  merchant: one(merchants, {
    fields: [merchantMedia.merchantId],
    references: [merchants.id],
  }),
}));

export const merchantServicesRelations = relations(merchantServices, ({ one }) => ({
  merchant: one(merchants, {
    fields: [merchantServices.merchantId],
    references: [merchants.id],
  }),
  category: one(serviceCategories, {
    fields: [merchantServices.categoryId],
    references: [serviceCategories.id],
  }),
}));

import 'server-only'
import type { Store } from '@/server/db/types'
import { getSetting } from '@/server/services/common'
import {
  DEFAULT_DOCUMENT_TEMPLATE,
  DEFAULT_INSTITUTION,
  DEFAULT_RETENTION,
  SETTING_KEYS,
  documentTemplateSchema,
  institutionSchema,
  retentionSchema,
} from './defaults'

export const getInstitution = (store: Store) => getSetting(store, SETTING_KEYS.institution, institutionSchema, DEFAULT_INSTITUTION)
export const getDocumentTemplate = (store: Store) => getSetting(store, SETTING_KEYS.documentTemplate, documentTemplateSchema, DEFAULT_DOCUMENT_TEMPLATE)
export const getRetention = (store: Store) => getSetting(store, SETTING_KEYS.retention, retentionSchema, DEFAULT_RETENTION)

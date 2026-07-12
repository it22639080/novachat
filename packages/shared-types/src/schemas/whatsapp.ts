import { z } from "zod";

export const createWhatsAppAccountSchema = z.object({
  businessAccountId: z.string().trim().min(2).max(120),
  phoneNumberId: z.string().trim().min(2).max(120),
  displayPhoneNumber: z.string().trim().min(6).max(32),
  displayName: z.string().trim().min(2).max(120).optional(),
  accessToken: z.string().trim().min(20),
  webhookVerifyToken: z.string().trim().min(8).max(256)
});

export const updateWhatsAppAccountSchema = createWhatsAppAccountSchema.partial().extend({
  status: z.enum(["PENDING", "CONNECTED", "DISCONNECTED", "DISABLED"]).optional()
});

export const whatsAppAccountIdParamSchema = z.object({
  id: z.string().uuid()
});

export const sendWhatsAppBaseSchema = z.object({
  accountId: z.string().uuid(),
  to: z.string().trim().min(6).max(32)
});

export const sendWhatsAppTextSchema = sendWhatsAppBaseSchema.extend({
  text: z.string().trim().min(1).max(4000)
});

export const sendWhatsAppMediaSchema = sendWhatsAppBaseSchema.extend({
  type: z.enum(["image", "document"]),
  mediaUrl: z.string().trim().url(),
  caption: z.string().trim().max(1024).optional(),
  filename: z.string().trim().max(240).optional()
});

export const sendWhatsAppTemplateSchema = sendWhatsAppBaseSchema.extend({
  templateName: z.string().trim().min(1).max(512),
  languageCode: z.string().trim().min(2).max(20).default("en_US"),
  components: z.array(z.record(z.unknown())).default([])
});

export const sendWhatsAppButtonsSchema = sendWhatsAppBaseSchema.extend({
  bodyText: z.string().trim().min(1).max(1024),
  headerText: z.string().trim().max(60).optional(),
  footerText: z.string().trim().max(60).optional(),
  buttons: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(256),
        title: z.string().trim().min(1).max(20)
      })
    )
    .min(1)
    .max(3)
});

export const sendWhatsAppListSchema = sendWhatsAppBaseSchema.extend({
  bodyText: z.string().trim().min(1).max(1024),
  buttonText: z.string().trim().min(1).max(20),
  headerText: z.string().trim().max(60).optional(),
  footerText: z.string().trim().max(60).optional(),
  sections: z
    .array(
      z.object({
        title: z.string().trim().max(24).optional(),
        rows: z
          .array(
            z.object({
              id: z.string().trim().min(1).max(200),
              title: z.string().trim().min(1).max(24),
              description: z.string().trim().max(72).optional()
            })
          )
          .min(1)
          .max(10)
      })
    )
    .min(1)
    .max(10)
});

export type CreateWhatsAppAccountInput = z.infer<typeof createWhatsAppAccountSchema>;
export type UpdateWhatsAppAccountInput = z.infer<typeof updateWhatsAppAccountSchema>;
export type SendWhatsAppTextInput = z.infer<typeof sendWhatsAppTextSchema>;
export type SendWhatsAppMediaInput = z.infer<typeof sendWhatsAppMediaSchema>;
export type SendWhatsAppTemplateInput = z.infer<typeof sendWhatsAppTemplateSchema>;
export type SendWhatsAppButtonsInput = z.infer<typeof sendWhatsAppButtonsSchema>;
export type SendWhatsAppListInput = z.infer<typeof sendWhatsAppListSchema>;

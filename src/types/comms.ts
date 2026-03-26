// SOLIS AI — Communications types

export type TwilioMessageResult = {
  success: boolean;
  messageSid?: string;
  error?: string;
  channel: "sms" | "whatsapp";
};

export type EmailResult = {
  success: boolean;
  id?: string;
  error?: string;
};

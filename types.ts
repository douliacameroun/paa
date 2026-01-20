
export type MessagePartType = 'text' | 'link' | 'bold' | 'error' | 'audio' | 'file';

export interface MessagePart {
  text?: string; // Text might be optional if it's purely an audio part
  type: MessagePartType;
  href?: string; // For 'link' type
  audioBase64?: string; // For 'audio' type
  fileData?: string; // Base64 encoded file data
  mimeType?: string; // MIME type of the file
  fileName?: string; // Original name of the file
}

export interface Message {
  id: string;
  sender: 'user' | 'bot';
  parts: MessagePart[];
}

export interface Service {
  id: string;
  icon: string;
  titleFr: string;
  descriptionFr: string;
  titleEn: string;
  descriptionEn: string;
}

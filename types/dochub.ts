export type ActiveView = 'dashboard' | 'import' | 'editor' | 'candidate_sign' | 'completed_docs';

export interface DocumentField {
  id: string;
  type: 'text' | 'paragraph' | 'checkbox' | 'radio' | 'dropdown' | 'image' | 'attachment' | 'signature' | 'initials' | 'date';
  label: string;
  x: number; // percentage (0 to 100)
  y: number; // percentage (0 to 100)
  width?: number; // width in px
  height?: number; // height in px
  fontSize?: number;
  isBold?: boolean;
  isItalic?: boolean;
  color?: string;
  value?: string;
  isLocked?: boolean;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: string;
  pages: number;
  progress: number;
  status: 'uploading' | 'processing' | 'ready';
  thumbnailUrl?: string;
  fileObject?: File;
}

export interface RecentDoc {
  id: string;
  title: string;
  updatedAt: string;
  pages: number;
  status: 'Completed' | 'Pending' | 'Pending Sign' | 'Draft';
  size: string;
  fileUrl?: string;
  fileType?: string;
  placedFields?: DocumentField[];
  filledFields?: DocumentField[];
}

export interface ActiveDocument {
  id: string;
  name: string;
  size: string;
  pages: number;
  fileUrl?: string;
  fileType?: string;
  placedFields?: DocumentField[];
  filledFields?: DocumentField[];
  status?: string;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  plan: string;
  isLoggedIn: boolean;
}

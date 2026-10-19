// Admin Web App Type Definitions — Firebase Edition

export type VideoStatus = 'draft' | 'published' | 'archived';

export interface Subject {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  units?: string[];
}

export interface VideoMaterial {
  id?: string;
  title: string;
  url: string;
  type?: 'pdf' | 'doc' | 'link' | 'drive' | 'github' | 'other';
}

export interface Video {
  id: string;
  title: string;
  description?: string;
  subject_id?: string;
  subject_name?: string;
  chapter?: string;
  unit?: string;
  unit_order?: number;
  video_url: string;
  thumbnail_url?: string;
  material_url?: string;
  material_title?: string;
  materials?: VideoMaterial[];
  duration: number;          // seconds
  status: VideoStatus;
  views: number;
  is_live?: boolean;         // Scheduled Premiere / Live Stream
  scheduled_at?: string;     // ISO timestamp when the live stream begins
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_videos: number;
  published_videos: number;
  draft_videos: number;
  total_subjects: number;
  total_views: number;
  recent_uploads: Video[];
}

export interface AdminUser {
  uid: string;
  email: string | null;
}

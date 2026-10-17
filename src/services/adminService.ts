import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { ref, listAll, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { db, auth, storage } from './firebase';
import type { Video, Subject, DashboardStats } from '../types';

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function signInAdmin(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}

export function onAuthChanged(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function parseCreatedDate(raw: any): string {
  if (!raw) return new Date(Date.now() - 3600000).toISOString();
  try {
    if (raw && typeof raw.toDate === 'function') {
      return raw.toDate().toISOString();
    }
    if (raw && typeof raw.seconds === 'number') {
      return new Date(raw.seconds * 1000).toISOString();
    }
    if (typeof raw === 'number') {
      return new Date(raw).toISOString();
    }
    if (typeof raw === 'string') {
      const p = new Date(raw);
      if (!isNaN(p.getTime())) {
        return p.toISOString();
      }
    }
  } catch {}
  return new Date().toISOString();
}

function docToVideo(d: QueryDocumentSnapshot<DocumentData>): Video {
  const data = d.data();
  const createdStr = parseCreatedDate(data.created_at);
  const updatedStr = parseCreatedDate(data.updated_at || data.created_at);
  const rawDur = typeof data.duration === 'number' ? data.duration : (parseInt(data.duration, 10) || 0);

  return {
    id: d.id,
    title: data.title ?? '',
    description: data.description ?? '',
    subject_id: data.subject_id ?? '',
    subject_name: data.subject_name ?? '',
    chapter: data.chapter ?? data.unit ?? '',
    unit: data.unit ?? data.chapter ?? '',
    unit_order: typeof data.unit_order === 'number' ? data.unit_order : 0,
    duration: rawDur > 0 ? rawDur : 600,
    thumbnail_url: data.thumbnail_url ?? '',
    video_url: data.video_url ?? '',
    status: (data.status ?? 'published') as 'published' | 'draft',
    views: typeof data.views === 'number' ? data.views : (parseInt(data.views, 10) || 0),
    created_at: createdStr,
    updated_at: updatedStr,
  };
}

function docToSubject(d: QueryDocumentSnapshot<DocumentData>): Subject {
  const data = d.data();
  return {
    id: d.id,
    name: data.name ?? '',
    description: data.description ?? '',
    icon: data.icon ?? '📚',
    color: data.color ?? '#F97316',
    units: Array.isArray(data.units) ? data.units : [],
  };
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function fetchDashboardStats(videosList: Video[], subjectsList: Subject[]): Promise<DashboardStats> {
  const totalViews = videosList.reduce((sum, v) => sum + (v.views ?? 0), 0);
  const pubCount = videosList.filter(v => v.status === 'published').length;

  return {
    total_videos: videosList.length,
    published_videos: pubCount,
    draft_videos: videosList.length - pubCount,
    total_subjects: subjectsList.length,
    total_views: totalViews,
    recent_uploads: videosList.slice(0, 5),
  };
}

// ─── Videos CRUD ─────────────────────────────────────────────────────────────

export async function fetchAdminVideos(): Promise<Video[]> {
  try {
    const snap = await getDocs(collection(db, 'videos'));
    const list = snap.docs.map(docToVideo);
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (err) {
    console.warn('Firestore fetchAdminVideos:', err);
    return [];
  }
}

export async function createVideo(data: Omit<Video, 'id' | 'created_at' | 'updated_at' | 'views'>): Promise<string> {
  const ref_ = await addDoc(collection(db, 'videos'), {
    ...data,
    views: 0,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return ref_.id;
}

export async function updateVideo(id: string, data: Partial<Omit<Video, 'id' | 'created_at'>>): Promise<void> {
  const updatePayload: Record<string, any> = { ...data };
  // Never overwrite or zero out real views if not explicitly provided as a number
  if (updatePayload.views === undefined || updatePayload.views === null) {
    delete updatePayload.views;
  }
  await updateDoc(doc(db, 'videos', id), {
    ...updatePayload,
    updated_at: serverTimestamp(),
  });
}

export async function deleteVideo(id: string): Promise<void> {
  await deleteDoc(doc(db, 'videos', id));
}

export async function togglePublishVideo(id: string, currentStatus: string): Promise<void> {
  const newStatus = currentStatus === 'published' ? 'draft' : 'published';
  await updateDoc(doc(db, 'videos', id), {
    status: newStatus,
    updated_at: serverTimestamp(),
  });
}

// ─── Subjects & Units ────────────────────────────────────────────────────────

export async function fetchAdminSubjects(): Promise<Subject[]> {
  try {
    const snap = await getDocs(collection(db, 'subjects'));
    if (!snap.empty) {
      return snap.docs.map(docToSubject);
    }
  } catch (err) {
    console.warn('Could not fetch subjects:', err);
  }
  return [];
}

export async function createSubject(data: Omit<Subject, 'id'>): Promise<string> {
  const ref_ = await addDoc(collection(db, 'subjects'), {
    ...data,
    units: data.units ?? [],
  });
  return ref_.id;
}

export async function deleteSubject(id: string): Promise<void> {
  await deleteDoc(doc(db, 'subjects', id));
}

export async function addUnitToSubject(subjectId: string, unitName: string): Promise<void> {
  const cleanName = unitName.trim();
  if (!subjectId || !cleanName) return;
  try {
    await updateDoc(doc(db, 'subjects', subjectId), {
      units: arrayUnion(cleanName),
    });
  } catch (err) {
    console.warn('Failed to add unit to subject:', err);
  }
}

export async function removeUnitFromSubject(subjectId: string, unitName: string): Promise<void> {
  const cleanName = unitName.trim();
  if (!subjectId || !cleanName) return;
  try {
    await updateDoc(doc(db, 'subjects', subjectId), {
      units: arrayRemove(cleanName),
    });
  } catch (err) {
    console.warn('Failed to remove unit from subject:', err);
  }
}

// ─── Real Video Folder Scanner ───────────────────────────────────────────────

export interface StorageVideoItem {
  name: string;
  url: string;
  source: 'firebase_storage' | 'public_folder';
}

export async function listAvailableFolderVideos(): Promise<StorageVideoItem[]> {
  const results: StorageVideoItem[] = [];

  // 1. Fetch real physical videos found inside public/videos/
  try {
    const res = await fetch('/api/folder-videos');
    if (res.ok) {
      const folderVideos: StorageVideoItem[] = await res.json();
      folderVideos.forEach(v => results.push(v));
    }
  } catch (e) {
    console.warn('Could not query /api/folder-videos:', e);
  }

  // 2. Query Firebase Storage 'videos' folder
  try {
    const listTimeout = new Promise<StorageVideoItem[]>((resolve) => {
      setTimeout(() => resolve([]), 2500);
    });

    const storageFetch = async (): Promise<StorageVideoItem[]> => {
      const videosFolderRef = ref(storage, 'videos');
      const folderRes = await listAll(videosFolderRef);
      const items = await Promise.all(
        folderRes.items.map(async (itemRef): Promise<StorageVideoItem | null> => {
          try {
            const url = await getDownloadURL(itemRef);
            return { name: itemRef.name, url, source: 'firebase_storage' };
          } catch {
            return null;
          }
        })
      );
      return items.filter((x): x is StorageVideoItem => Boolean(x));
    };

    const storageVideos = await Promise.race([storageFetch(), listTimeout]);
    storageVideos.forEach(sv => results.push(sv));
  } catch (err) {
    console.warn('Storage listAll skipped or timed out:', err);
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return results.filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

// ─── Direct Media Upload Helper ──────────────────────────────────────────────

export function uploadMediaFile(
  file: File,
  folder: 'videos' | 'thumbnails',
  onProgress?: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageRef = ref(storage, `${folder}/${Date.now()}_${safeName}`);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      'state_changed',
      snapshot => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress?.(pct);
      },
      reject,
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (e) {
          reject(e);
        }
      },
    );
  });
}

// ─── Video Link & Source Parser ──────────────────────────────────────────────

export interface VideoSourceInfo {
  type: 'youtube' | 'vimeo' | 'drive' | 'direct';
  embedUrl: string;
  directStreamUrl?: string;
  originalUrl: string;
  videoId?: string;
  suggestedThumbnail?: string;
  label: string;
}

export function parseVideoSource(url: string): VideoSourceInfo {
  if (!url) {
    return { type: 'direct', embedUrl: '', originalUrl: '', label: 'Direct Video' };
  }
  const cleanUrl = url.trim();

  // 1. YouTube
  const ytMatch = cleanUrl.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i
  );
  if (ytMatch && ytMatch[1]) {
    const id = ytMatch[1];
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&enablejsapi=1`,
      originalUrl: cleanUrl,
      videoId: id,
      suggestedThumbnail: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
      label: 'YouTube',
    };
  }

  // 2. Vimeo
  const vimeoMatch = cleanUrl.match(
    /(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+))/i
  );
  if (vimeoMatch && (vimeoMatch[3] || vimeoMatch[1])) {
    const id = vimeoMatch[3] || vimeoMatch[1];
    return {
      type: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1`,
      originalUrl: cleanUrl,
      videoId: id,
      label: 'Vimeo',
    };
  }

  // 3. Google Drive (Files & Folders)
  const driveFolderMatch = cleanUrl.match(
    /drive\.google\.com\/(?:drive\/(?:u\/\d+\/)?folders\/|folders\/)([a-zA-Z0-9_-]+)/i
  );
  if (driveFolderMatch && driveFolderMatch[1]) {
    const folderId = driveFolderMatch[1];
    if (folderId === '1j3hCE2dpEkKvTS8lV0J6bXAmsK9u4BTh') {
      const fileId = '1akjgeI2iL4n_yyigsVDSBHiowBoWufbM';
      return {
        type: 'drive',
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        originalUrl: cleanUrl,
        videoId: fileId,
        suggestedThumbnail: `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`,
        label: 'Google Drive',
      };
    }
    return {
      type: 'drive',
      embedUrl: `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`,
      originalUrl: cleanUrl,
      videoId: folderId,
      suggestedThumbnail: `https://drive.google.com/thumbnail?id=${folderId}&sz=w800`,
      label: 'Google Drive',
    };
  }

  // File match (file/d/ID, open?id=ID, uc?id=ID, docs.google.com/file/d/ID)
  const driveFileMatch = cleanUrl.match(
    /(?:drive|docs)\.google\.com\/(?:file\/(?:u\/\d+\/)?d\/|open\?id=|uc\?(?:.*&)?id=)([a-zA-Z0-9_-]+)/i
  );
  if (driveFileMatch && driveFileMatch[1]) {
    const fileId = driveFileMatch[1];
    return {
      type: 'drive',
      embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      originalUrl: cleanUrl,
      videoId: fileId,
      suggestedThumbnail: `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`,
      label: 'Google Drive',
    };
  }

  // 4. Direct / Local
  let directUrl = cleanUrl;
  if (cleanUrl.startsWith('/videos/')) {
    try {
      const decoded = decodeURIComponent(cleanUrl);
      directUrl = encodeURI(decoded);
    } catch {
      directUrl = cleanUrl;
    }
  }

  return {
    type: 'direct',
    embedUrl: directUrl,
    originalUrl: cleanUrl,
    label: cleanUrl.startsWith('/videos/') ? 'Local File' : 'Direct Link',
  };
}


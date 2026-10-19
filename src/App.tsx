import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck,
  Video as VideoIcon,
  BookOpen,
  Eye,
  EyeOff,
  Trash2,
  Edit,
  Plus,
  Play,
  X,
  Upload,
  LogOut,
  Search,
  CheckCircle2,
  AlertCircle,
  Layers,
  RefreshCw,
  FolderOpen,
  FileVideo,
  Check,
  FolderPlus,
  Link,
  Clock,
  ListVideo,
  FileText,
  ExternalLink,
  Paperclip,
  Radio,
} from 'lucide-react';
import type { Video, Subject, DashboardStats, AdminUser } from './types';
import {
  signInAdmin,
  signOutAdmin,
  onAuthChanged,
  fetchDashboardStats,
  fetchAdminVideos,
  createVideo,
  updateVideo,
  deleteVideo,
  togglePublishVideo,
  fetchAdminSubjects,
  createSubject,
  deleteSubject,
  addUnitToSubject,
  removeUnitFromSubject,
  uploadMediaFile,
  listAvailableFolderVideos,
  type StorageVideoItem,
  parseVideoSource,
} from './services/adminService';

export function App() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'videos' | 'subjects'>('videos');

  // Data
  const [stats, setStats] = useState<DashboardStats>({
    total_videos: 0,
    published_videos: 0,
    draft_videos: 0,
    total_subjects: 0,
    total_views: 0,
    recent_uploads: [],
  });
  const [videos, setVideos] = useState<Video[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [availableVideos, setAvailableVideos] = useState<StorageVideoItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);
  const [deleteTargetVideo, setDeleteTargetVideo] = useState<Video | null>(null);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [deleteTargetSubject, setDeleteTargetSubject] = useState<Subject | null>(null);
  const [selectedSubjectForUnits, setSelectedSubjectForUnits] = useState<Subject | null>(null);
  const [newUnitInput, setNewUnitInput] = useState('');

  // Form Fields:
  // Video Source Mode: 'folder' or 'link'
  const [videoSourceMode, setVideoSourceMode] = useState<'folder' | 'link'>('folder');
  // 1. Video URL / Folder
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formLinkInput, setFormLinkInput] = useState('');
  // 2. Name / Title
  const [formTitle, setFormTitle] = useState('');
  // 3. Description
  const [formDesc, setFormDesc] = useState('');
  // 4. Subject
  const [formSubjectId, setFormSubjectId] = useState('');
  // 4b. Unit / Playlist
  const [formUnit, setFormUnit] = useState('');
  const [formCustomUnit, setFormCustomUnit] = useState('');
  const [formUnitOrder, setFormUnitOrder] = useState('1');
  // 5. Thumbnail (Image URL or uploaded)
  const [formThumbUrl, setFormThumbUrl] = useState('');
  const [formDuration, setFormDuration] = useState('600');
  const [formPublished, setFormPublished] = useState(true);
  // 6. Scheduled Premiere / Live Stream
  const [formIsLive, setFormIsLive] = useState(false);
  const [formScheduledAt, setFormScheduledAt] = useState('');
  // 7. Materials / PDF / Drive Link
  const [formMaterialUrl, setFormMaterialUrl] = useState('');
  const [formMaterialTitle, setFormMaterialTitle] = useState('');

  // Uploading thumbnail
  const [thumbUploading, setThumbUploading] = useState(false);
  const [thumbProgress, setThumbProgress] = useState(0);

  // Folder Direct Video Upload Helper
  const [_folderUploading, setFolderUploading] = useState(false);
  const [_folderUploadProgress, setFolderUploadProgress] = useState(0);

  // Auto-fetch Title state
  const [fetchingTitle, setFetchingTitle] = useState(false);
  const [autoFilledTitle, setAutoFilledTitle] = useState(false);
  const lastFetchedVideoIdRef = useRef<string>('');

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Subject form
  const [subjName, setSubjName] = useState('');
  const [subjDesc, setSubjDesc] = useState('');
  const [subjColor, setSubjColor] = useState('#2563EB');

  // ── Auth listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthChanged(u => {
      setUser(u ? { uid: u.uid, email: u.email } : null);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // ── Data loading (empty dependency array - runs only on initial mount or manual call) ──
  const loadData = useCallback(() => {
    setDataLoading(true);

    // 1. Fetch available folder videos
    listAvailableFolderVideos()
      .then(fVids => {
        setAvailableVideos(fVids);
        setFormVideoUrl(prev => prev || (fVids[0]?.url ?? ''));
      })
      .catch(e => console.warn('Folder videos error:', e));

    // 2. Fetch admin subjects
    fetchAdminSubjects()
      .then(sList => {
        setSubjects(sList);
      })
      .catch(e => console.warn('Subjects error:', e));

    // 3. Fetch admin videos & calculate stats
    fetchAdminVideos()
      .then(vList => {
        setVideos(vList);
        fetchDashboardStats(vList, []).then(st => setStats(st)).catch(() => {});
      })
      .catch(e => console.warn('Videos error:', e))
      .finally(() => {
        setDataLoading(false);
      });
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user?.uid]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Auth Handlers ──────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      await signInAdmin(email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed.';
      setLoginError(
        msg.includes('auth') || msg.includes('password')
          ? 'Invalid admin credentials.'
          : msg
      );
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await signOutAdmin();
  };

  // ── Auto Detect Duration from Video File ──────────────────────────────────
  const autoDetectDuration = (url: string) => {
    if (!url) return;
    try {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.src = url;
      v.onloadedmetadata = () => {
        if (v.duration && !isNaN(v.duration) && v.duration > 0) {
          setFormDuration(String(Math.round(v.duration)));
        }
      };
    } catch {}
  };

  // ── Open Editor ────────────────────────────────────────────────────────────
  const openEditorForNew = (
    mode: 'folder' | 'link' = 'folder',
    preselectedSubjectId?: string,
    preselectedUnit?: string
  ) => {
    setEditingVideo(null);
    setFormTitle('');
    setFormDesc('');
    const targetSubjId = preselectedSubjectId || subjects[0]?.id || '';
    setFormSubjectId(targetSubjId);
    setFormUnit(preselectedUnit || '');
    setFormCustomUnit('');

    // Auto-calculate next lesson number in playlist
    if (preselectedUnit) {
      const vidsInUnit = videos.filter(
        v => v.subject_id === targetSubjId && (v.unit === preselectedUnit || v.chapter === preselectedUnit)
      );
      setFormUnitOrder(String(vidsInUnit.length + 1));
    } else {
      setFormUnitOrder('1');
    }

    setFormThumbUrl('');
    setFormDuration(mode === 'link' ? '600' : '0');
    setFormPublished(true);
    setFormIsLive(false);
    setFormScheduledAt('');
    setFormMaterialUrl('');
    setFormMaterialTitle('');
    setVideoSourceMode(mode);

    if (mode === 'folder') {
      const initialUrl = availableVideos.length > 0 ? availableVideos[0].url : '/videos/lesson1.mp4';
      setFormVideoUrl(initialUrl);
      setFormLinkInput('');
      autoDetectDuration(initialUrl);
    } else {
      setFormVideoUrl('');
      setFormLinkInput('');
      setFormDuration('600');
    }

    setFetchingTitle(false);
    setAutoFilledTitle(false);
    lastFetchedVideoIdRef.current = '';
    setShowEditorModal(true);
  };

  const openEditorForEdit = (v: Video) => {
    setEditingVideo(v);
    setFormTitle(v.title);
    setFormDesc(v.description || '');
    setFormSubjectId(v.subject_id || '');
    setFormUnit(v.unit || v.chapter || '');
    setFormCustomUnit('');
    setFormUnitOrder(String(v.unit_order || 1));
    setFormVideoUrl(v.video_url);
    setFormThumbUrl(v.thumbnail_url || '');
    setFormDuration(String(v.duration || 600));
    setFormPublished(v.status === 'published');
    setFormIsLive(Boolean(v.is_live));
    setFormScheduledAt(v.scheduled_at ? v.scheduled_at.slice(0, 16) : '');
    setFormMaterialUrl(v.material_url || v.materials?.[0]?.url || '');
    setFormMaterialTitle(v.material_title || v.materials?.[0]?.title || '');

    const parsed = parseVideoSource(v.video_url);
    if (parsed.type !== 'direct' || v.video_url.startsWith('http')) {
      setVideoSourceMode('link');
      setFormLinkInput(v.video_url);
    } else {
      setVideoSourceMode('folder');
      setFormLinkInput('');
    }

    if (!v.duration || v.duration === 600) {
      if (parsed.type === 'direct') {
        autoDetectDuration(v.video_url);
      }
    }
    setFetchingTitle(false);
    setAutoFilledTitle(false);
    lastFetchedVideoIdRef.current = '';
    setShowEditorModal(true);
  };

  // ── Auto-fetch Video Metadata (YouTube / Vimeo / Drive Title & Thumbnail) ───
  const fetchVideoMetadata = async (url: string, force = false) => {
    const clean = url.trim();
    if (!clean) return;
    const parsed = parseVideoSource(clean);

    if (parsed.type === 'youtube' && parsed.videoId) {
      // Avoid duplicate redundant calls unless forced
      if (!force && lastFetchedVideoIdRef.current === parsed.videoId && formTitle.trim()) {
        return;
      }
      lastFetchedVideoIdRef.current = parsed.videoId;

      // Auto-set high resolution thumbnail
      if (!formThumbUrl || formThumbUrl.includes('unsplash.com') || force) {
        setFormThumbUrl(parsed.suggestedThumbnail || `https://img.youtube.com/vi/${parsed.videoId}/maxresdefault.jpg`);
      }
      if (!formDuration || formDuration === '0') {
        setFormDuration('600');
      }

      setFetchingTitle(true);
      const canonicalYt = `https://www.youtube.com/watch?v=${parsed.videoId}`;

      try {
        let fetchedTitle = '';
        let fetchedAuthor = '';

        // Method 1: noembed.com (CORS enabled, highly reliable)
        try {
          const res1 = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(canonicalYt)}`);
          if (res1.ok) {
            const data1 = await res1.json();
            if (data1.title) {
              fetchedTitle = data1.title;
              fetchedAuthor = data1.author_name || '';
            }
          }
        } catch {}

        // Method 2: Direct YouTube oembed fallback
        if (!fetchedTitle) {
          try {
            const res2 = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalYt)}&format=json`);
            if (res2.ok) {
              const data2 = await res2.json();
              if (data2.title) {
                fetchedTitle = data2.title;
                fetchedAuthor = data2.author_name || '';
              }
            }
          } catch {}
        }

        // Method 3: AllOrigins CORS proxy fallback
        if (!fetchedTitle) {
          try {
            const res3 = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.youtube.com/oembed?url=${canonicalYt}&format=json`)}`);
            if (res3.ok) {
              const data3 = await res3.json();
              if (data3.title) {
                fetchedTitle = data3.title;
                fetchedAuthor = data3.author_name || '';
              }
            }
          } catch {}
        }

        if (fetchedTitle) {
          setFormTitle(fetchedTitle);
          setAutoFilledTitle(true);
          if (!formDesc.trim() && fetchedAuthor) {
            setFormDesc(`Presented by ${fetchedAuthor}`);
          }
          showToast('success', `Auto-filled video title from YouTube!`);
        }
      } catch (err) {
        console.warn('Auto-fetch title error:', err);
      } finally {
        setFetchingTitle(false);
      }
    } else if (parsed.type === 'vimeo' && parsed.videoId) {
      if (!force && lastFetchedVideoIdRef.current === parsed.videoId && formTitle.trim()) {
        return;
      }
      lastFetchedVideoIdRef.current = parsed.videoId;
      setFetchingTitle(true);
      try {
        const res = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${parsed.videoId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.title) {
            setFormTitle(data.title);
            setAutoFilledTitle(true);
            showToast('success', `Auto-filled video title from Vimeo!`);
          }
          if (data.thumbnail_url && (!formThumbUrl || formThumbUrl.includes('unsplash.com') || force)) {
            setFormThumbUrl(data.thumbnail_url);
          }
        }
      } catch {} finally {
        setFetchingTitle(false);
      }
    } else if (parsed.type === 'drive') {
      if (parsed.suggestedThumbnail && (!formThumbUrl || formThumbUrl.includes('unsplash.com') || force)) {
        setFormThumbUrl(parsed.suggestedThumbnail);
      }
      if (!formDuration || formDuration === '0') {
        setFormDuration('600');
      }
    } else if (parsed.type === 'direct' && clean.startsWith('http')) {
      autoDetectDuration(clean);
    }
  };

  const handleLinkInputChange = (newLink: string, force = false) => {
    setFormLinkInput(newLink);
    const clean = newLink.trim();
    setFormVideoUrl(clean);
    if (clean) {
      fetchVideoMetadata(clean, force);
    }
  };

  // ── Save Video (Stores Name, Desc, Subject, Unit/Playlist, Thumb, Video URL) ───────────────
  const handleSaveVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showToast('error', 'Please enter a video name/title.');
      return;
    }

    const finalVideoUrl = (videoSourceMode === 'link' ? formLinkInput.trim() : formVideoUrl).trim();
    if (!finalVideoUrl) {
      showToast(
        'error',
        videoSourceMode === 'link'
          ? 'Please enter a video link/URL (e.g. YouTube, Vimeo, or MP4 link).'
          : 'Please select a video file from the folder dropdown.'
      );
      return;
    }

    const selectedSubj = subjects.find(s => s.id === formSubjectId);
    const parsedDur = parseInt(formDuration, 10);
    const finalDuration = parsedDur > 0 ? parsedDur : (videoSourceMode === 'link' ? 600 : 0);

    const finalUnit = (formUnit === '__new__' ? formCustomUnit.trim() : formUnit.trim());
    const finalUnitOrder = parseInt(formUnitOrder, 10) || 1;

    const finalMaterialUrl = formMaterialUrl.trim();
    const finalMaterialTitle = formMaterialTitle.trim() || (finalMaterialUrl ? 'Lecture Notes & Study Material' : '');

    const payload = {
      title: formTitle.trim(),
      description: formDesc.trim(),
      subject_id: formSubjectId,
      subject_name: selectedSubj?.name || 'General',
      chapter: finalUnit,
      unit: finalUnit,
      unit_order: finalUnitOrder,
      video_url: finalVideoUrl,
      thumbnail_url: formThumbUrl.trim(),
      material_url: finalMaterialUrl,
      material_title: finalMaterialTitle,
      materials: finalMaterialUrl ? [{ title: finalMaterialTitle, url: finalMaterialUrl }] : [],
      duration: finalDuration,
      status: (formPublished ? 'published' : 'draft') as 'published' | 'draft',
      is_live: formIsLive,
      scheduled_at: formIsLive && formScheduledAt ? new Date(formScheduledAt).toISOString() : '',
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingVideo) {
        await updateVideo(editingVideo.id, payload);
        showToast('success', `Video updated successfully${finalUnit ? ` in unit "${finalUnit}"` : ''}!`);
      } else {
        await createVideo(payload);
        showToast(
          'success',
          videoSourceMode === 'link'
            ? `Video link added${finalUnit ? ` to unit "${finalUnit}"` : ''}!`
            : `Video published from folder${finalUnit ? ` to unit "${finalUnit}"` : ''}!`
        );
      }

      // If a unit was specified, ensure it is added to the subject's units array in Firestore
      if (formSubjectId && finalUnit) {
        await addUnitToSubject(formSubjectId, finalUnit);
      }

      setShowEditorModal(false);
      loadData();
    } catch {
      showToast('error', 'Failed to save to Firebase.');
    }
  };

  // ── Upload Thumbnail Direct ────────────────────────────────────────────────
  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbUploading(true);
    setThumbProgress(0);
    try {
      const url = await uploadMediaFile(file, 'thumbnails', pct =>
        setThumbProgress(pct)
      );
      setFormThumbUrl(url);
      showToast('success', 'Thumbnail uploaded & linked!');
    } catch {
      showToast('error', 'Thumbnail upload failed.');
    } finally {
      setThumbUploading(false);
    }
  };

  // ── Upload Video into Folder ───────────────────────────────────────────────
  const handleUploadVideoToFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFolderUploading(true);
    setFolderUploadProgress(0);
    try {
      const url = await uploadMediaFile(file, 'videos', pct =>
        setFolderUploadProgress(pct)
      );
      showToast('success', `"${file.name}" added to Videos folder!`);
      // Refresh folder list & select newly uploaded video
      const updatedList = await listAvailableFolderVideos();
      setAvailableVideos(updatedList);
      setFormVideoUrl(url);
    } catch {
      showToast('error', 'Failed to upload video to folder.');
    } finally {
      setFolderUploading(false);
    }
  };

  // ── Video Actions ──────────────────────────────────────────────────────────
  const handleTogglePublish = async (video: Video) => {
    await togglePublishVideo(video.id, video.status);
    const ns = video.status === 'published' ? 'draft' : 'published';
    showToast(
      'success',
      `Video status: ${ns === 'published' ? 'LIVE (Students can watch)' : 'DRAFT'}`
    );
    loadData();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetVideo) return;
    await deleteVideo(deleteTargetVideo.id);
    showToast('success', 'Video removed from catalogue.');
    setDeleteTargetVideo(null);
    loadData();
  };

  // ── Subjects ───────────────────────────────────────────────────────────────
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjName.trim()) return;
    await createSubject({
      name: subjName.trim(),
      description: subjDesc.trim(),
      color: subjColor,
      icon: '📚',
    });
    showToast('success', `Subject "${subjName}" added.`);
    setShowSubjectModal(false);
    setSubjName('');
    setSubjDesc('');
    loadData();
  };

  const handleConfirmDeleteSubject = async () => {
    if (!deleteTargetSubject) return;
    await deleteSubject(deleteTargetSubject.id);
    showToast('success', 'Subject removed.');
    setDeleteTargetSubject(null);
    loadData();
  };

  const filteredVideos = videos.filter(v => {
    const matchStatus = statusFilter === 'all' || v.status === statusFilter;
    const matchUnit =
      unitFilter === 'all' ||
      (unitFilter === '__unassigned__'
        ? !v.unit && !v.chapter
        : (v.unit || v.chapter) === unitFilter);
    const q = searchQuery.toLowerCase();
    return (
      matchStatus &&
      matchUnit &&
      (!q ||
        v.title.toLowerCase().includes(q) ||
        (v.subject_name ?? '').toLowerCase().includes(q) ||
        (v.unit ?? '').toLowerCase().includes(q))
    );
  });

  const fmtDur = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
        }}
      >
        <RefreshCw
          size={36}
          style={{ animation: 'spin 1s linear infinite', color: 'var(--brand)' }}
        />
      </div>
    );
  }

  // ── Login screen (No Bloatware, Clean Minimalist UI) ─────────────────────────
  if (!user) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          padding: '1.5rem',
        }}
      >
        <div
          style={{
            maxWidth: 400,
            width: '100%',
            background: '#FFFFFF',
            border: '1.5px solid var(--border)',
            borderRadius: 24,
            padding: '2.5rem',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <img
              src="/logo.png"
              alt="electrONLearning Logo"
              style={{
                width: 90,
                height: 90,
                borderRadius: 20,
                objectFit: 'contain',
                margin: '0 auto 1rem',
                display: 'block',
                background: '#fff',
                padding: 4,
                boxShadow: 'var(--shadow-md)',
                border: '1.5px solid var(--border)',
              }}
            />
            <h1
              style={{
                fontSize: '1.65rem',
                fontWeight: 900,
                color: 'var(--brand-dark)',
              }}
            >
              electr<span style={{ color: 'var(--brand)' }}>ON</span>Learning
            </h1>
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.82rem',
                fontWeight: 600,
                marginTop: '0.3rem',
              }}
            >
              Admin Dashboard
            </p>
          </div>

          {loginError && (
            <div
              style={{
                background: '#FEF2F2',
                border: '1.5px solid #FECACA',
                color: '#DC2626',
                padding: '0.75rem 1rem',
                borderRadius: 12,
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 600,
              }}
            >
              <AlertCircle size={16} /> {loginError}
            </div>
          )}

          <form
            onSubmit={handleLogin}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <div className="form-group">
              <label className="form-label">Admin Email</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@electronlearning.com"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                marginTop: '0.5rem',
                padding: '0.75rem',
              }}
              disabled={loggingIn}
            >
              {loggingIn ? (
                <>
                  <RefreshCw
                    size={16}
                    style={{ animation: 'spin 1s linear infinite' }}
                  />{' '}
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck size={16} /> Login to Admin
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Main Admin Portal ───────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '1.25rem',
            right: '1.25rem',
            zIndex: 9999,
            background: toast.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            border: `1.5px solid ${toast.type === 'success' ? '#6EE7B7' : '#FECACA'}`,
            color: toast.type === 'success' ? '#065F46' : '#DC2626',
            padding: '0.85rem 1.25rem',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            boxShadow: 'var(--shadow-lg)',
            fontSize: '0.88rem',
            fontWeight: 700,
          }}
        >
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}

      {/* Top Navbar */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <img
            src="/logo.png"
            alt="electrONLearning Logo"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              objectFit: 'contain',
              background: '#fff',
              padding: 2,
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--border)',
            }}
          />
          <div>
            <div
              style={{
                fontWeight: 900,
                fontSize: '1.05rem',
                color: 'var(--brand-dark)',
              }}
            >
              electr<span style={{ color: 'var(--brand)' }}>ON</span>Learning{' '}
              <span
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 50,
                  padding: '0.1rem 0.5rem',
                  marginLeft: 4,
                }}
              >
                ADMIN
              </span>
            </div>
            <div
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.68rem',
                fontWeight: 500,
              }}
            >
              Course Content Administration Console
            </div>
          </div>
        </div>

        {/* Tab Pills */}
        <div className="nav-links">
          <button
            className={`nav-item ${activeTab === 'videos' ? 'active' : ''}`}
            onClick={() => setActiveTab('videos')}
          >
            <VideoIcon size={15} /> Videos ({videos.length})
          </button>
          <button
            className={`nav-item ${activeTab === 'subjects' ? 'active' : ''}`}
            onClick={() => setActiveTab('subjects')}
          >
            <BookOpen size={15} /> Subjects ({subjects.length})
          </button>
          <button
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Layers size={15} /> Stats
          </button>
        </div>

        {/* User Info / Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {user.email}
            </div>
            <div
              style={{
                fontSize: '0.68rem',
                color: 'var(--brand)',
                fontWeight: 600,
              }}
            >
              Administrator
            </div>
          </div>
          <button
            className="btn-secondary"
            onClick={handleLogout}
            style={{ borderRadius: 50 }}
          >
            <LogOut size={14} /> Exit
          </button>
        </div>
      </nav>

      {/* Main Body */}
      <main
        style={{
          flex: 1,
          padding: '2rem 2.5rem',
          maxWidth: 1400,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {dataLoading && (
          <div
            style={{
              textAlign: 'center',
              padding: '4rem',
              color: 'var(--text-muted)',
            }}
          >
            <RefreshCw
              size={30}
              style={{ animation: 'spin 1s linear infinite', color: 'var(--brand)' }}
            />
          </div>
        )}

        {/* ── VIDEOS TAB (Primary admin view) ── */}
        {!dataLoading && activeTab === 'videos' && (
          <div key="videos" className="tab-pane-content">
            {/* Header with actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '1.4rem',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <FolderOpen size={22} color="var(--brand)" /> Video Management
                </h2>
                <p
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    marginTop: 3,
                  }}
                >
                  Select any video from your folder and configure Name, Description,
                  Subject, and Thumbnail.
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '0.6rem',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div className="search-box" style={{ width: 220 }}>
                  <Search size={14} color="var(--text-muted)" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search titles/subjects..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                <select
                  className="filter-select"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                >
                  <option value="all">All Status ({videos.length})</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>

                {(() => {
                  const allUnits = Array.from(
                    new Set(
                      videos
                        .map(v => v.unit || v.chapter || '')
                        .filter(Boolean)
                        .concat(subjects.flatMap(s => s.units || []))
                    )
                  );
                  if (allUnits.length === 0) return null;
                  return (
                    <select
                      className="filter-select"
                      value={unitFilter}
                      onChange={e => setUnitFilter(e.target.value)}
                      title="Filter by Unit Playlist"
                    >
                      <option value="all">All Units ({allUnits.length})</option>
                      <option value="__unassigned__">General (No Unit)</option>
                      {allUnits.map(u => (
                        <option key={u} value={u}>
                          📑 {u}
                        </option>
                      ))}
                    </select>
                  );
                })()}

                {/* Add options: from folder or by link */}
                <button
                  className="btn-secondary"
                  onClick={() => openEditorForNew('folder')}
                  style={{ borderRadius: 50, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <FolderOpen size={15} /> From Folder
                </button>
                <button
                  className="btn-primary"
                  onClick={() => openEditorForNew('link')}
                  style={{ borderRadius: 50, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Link size={15} /> Add Video by Link
                </button>
              </div>
            </div>

            {/* Quick folder upload & link banner */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1.5px dashed var(--border)',
                borderRadius: 16,
                padding: '1rem 1.5rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FolderPlus size={24} color="var(--brand)" />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>
                    Videos Source: Folder ({availableVideos.length} files) or Web Link (YouTube/MP4)
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Add videos from <code>public/videos/</code> or paste external links (YouTube, Vimeo, CDN MP4).
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => openEditorForNew('link')}
                  style={{
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.82rem',
                    borderRadius: 50,
                    padding: '0.55rem 1rem',
                  }}
                >
                  <Link size={14} /> Add Video by Link
                </button>

                <label
                  className="btn-secondary"
                  style={{
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.82rem',
                    borderRadius: 50,
                    padding: '0.55rem 1rem',
                  }}
                >
                  <Upload size={14} /> Upload Video to Folder
                  <input
                    type="file"
                    accept="video/*"
                    style={{ display: 'none' }}
                    onChange={handleUploadVideoToFolder}
                  />
                </label>
              </div>
            </div>

            {/* Video List Table */}
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Thumbnail</th>
                    <th>Name / Title</th>
                    <th>Subject & Unit</th>
                    <th>Video Source</th>
                    <th>Duration</th>
                    <th>Views</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVideos.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        style={{
                          textAlign: 'center',
                          padding: '4rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <FileVideo
                          size={40}
                          style={{
                            margin: '0 auto 0.75rem',
                            opacity: 0.3,
                            display: 'block',
                          }}
                        />
                        <div style={{ fontWeight: 700 }}>No videos found</div>
                        <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                          Click "Add Video by Link" or "From Folder" to add your first lesson.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredVideos.map(v => (
                      <tr key={v.id}>
                        <td>
                          {v.thumbnail_url && !v.thumbnail_url.includes('unsplash.com') ? (
                            <img
                              src={v.thumbnail_url}
                              alt={v.title}
                              style={{
                                width: 80,
                                height: 48,
                                objectFit: 'cover',
                                borderRadius: 8,
                                display: 'block',
                                border: '1px solid var(--border)',
                              }}
                              onError={e => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 80,
                                height: 48,
                                borderRadius: 8,
                                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#93C5FD',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                              }}
                            >
                              electrON
                            </div>
                          )}
                        </td>
                        <td style={{ maxWidth: 260 }}>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: '0.92rem',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {v.title}
                          </div>
                          {v.description && (
                            <div
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                marginTop: 2,
                              }}
                            >
                              {v.description}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                            <span className="subject-pill">
                              {v.subject_name || 'General'}
                            </span>
                            {v.unit || v.chapter ? (
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  background: 'rgba(59, 130, 246, 0.1)',
                                  color: '#2563eb',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: 6,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                                title={`Unit Playlist: ${v.unit || v.chapter}`}
                              >
                                <ListVideo size={11} /> {v.unit || v.chapter} (#{v.unit_order || 1})
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                No Unit
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ maxWidth: 220 }}>
                          {(() => {
                            const parsed = parseVideoSource(v.video_url);
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span
                                  style={{
                                    alignSelf: 'flex-start',
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: 6,
                                    background:
                                      parsed.type === 'youtube'
                                        ? 'rgba(239, 68, 68, 0.12)'
                                        : parsed.type === 'vimeo'
                                        ? 'rgba(59, 130, 246, 0.12)'
                                        : parsed.type === 'drive'
                                        ? 'rgba(16, 185, 129, 0.12)'
                                        : 'rgba(249, 115, 22, 0.12)',
                                    color:
                                      parsed.type === 'youtube'
                                        ? '#dc2626'
                                        : parsed.type === 'vimeo'
                                        ? '#2563eb'
                                        : parsed.type === 'drive'
                                        ? '#059669'
                                        : '#ea580c',
                                  }}
                                >
                                  {parsed.type === 'youtube' && '🔴 YouTube'}
                                  {parsed.type === 'vimeo' && '🔵 Vimeo'}
                                  {parsed.type === 'drive' && '🟢 Drive'}
                                  {parsed.type === 'direct' &&
                                    (v.video_url.startsWith('http') ? '🔗 Web Link' : '📁 Folder Video')}
                                </span>
                                <div
                                  style={{
                                    fontSize: '0.72rem',
                                    color: 'var(--text-secondary)',
                                    fontFamily: 'monospace',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    background: 'var(--bg-surface)',
                                    padding: '0.15rem 0.4rem',
                                    borderRadius: 6,
                                    border: '1px solid var(--border)',
                                  }}
                                  title={v.video_url}
                                >
                                  {v.video_url.split('/').pop()?.split('?')[0] || v.video_url}
                                </div>
                                {(v.material_url || (v.materials && v.materials.length > 0)) && (
                                  <a
                                    href={v.material_url || v.materials?.[0]?.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      color: '#2563EB',
                                      background: 'rgba(37, 99, 235, 0.08)',
                                      border: '1px solid rgba(37, 99, 235, 0.2)',
                                      borderRadius: 6,
                                      padding: '0.12rem 0.4rem',
                                      textDecoration: 'none',
                                      width: 'fit-content',
                                    }}
                                    title={`Material: ${v.material_title || 'Study Material'}`}
                                  >
                                    <Paperclip size={11} /> {v.material_title || 'Material'} <ExternalLink size={9} />
                                  </a>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                          {fmtDur(v.duration || 600)}
                        </td>
                        <td style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--brand)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Eye size={13} /> {v.views ?? 0}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${v.status}`}>{v.status}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <button
                              className="icon-btn"
                              title="Preview Video"
                              onClick={() => setPreviewVideo(v)}
                              style={{ color: '#0EA5E9' }}
                            >
                              <Play size={15} />
                            </button>
                            <button
                              className="icon-btn"
                              title="Edit Details"
                              onClick={() => openEditorForEdit(v)}
                              style={{ color: 'var(--brand)' }}
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              className="icon-btn"
                              title={
                                v.status === 'published'
                                  ? 'Unpublish (Set Draft)'
                                  : 'Publish Live'
                              }
                              onClick={() => handleTogglePublish(v)}
                              style={{
                                color:
                                  v.status === 'published' ? '#CA8A04' : '#16A34A',
                              }}
                            >
                              {v.status === 'published' ? (
                                <EyeOff size={15} />
                              ) : (
                                <Eye size={15} />
                              )}
                            </button>
                            <button
                              className="icon-btn"
                              title="Delete from Firebase"
                              onClick={() => setDeleteTargetVideo(v)}
                              style={{ color: '#DC2626' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── SUBJECTS TAB ── */}
        {!dataLoading && activeTab === 'subjects' && (
          <div key="subjects" className="tab-pane-content">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '1.4rem',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <BookOpen size={22} color="var(--brand)" /> Subject Categories
                </h2>
                <p
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    marginTop: 3,
                  }}
                >
                  Create subjects so you can organize your uploaded lessons.
                </p>
              </div>
              <button
                className="btn-primary"
                onClick={() => setShowSubjectModal(true)}
                style={{ borderRadius: 50 }}
              >
                <Plus size={16} /> New Subject
              </button>
            </div>

            <div className="subjects-admin-grid">
              {subjects.map(s => {
                const sVideos = videos.filter(v => v.subject_id === s.id);
                const sUnits = Array.from(
                  new Set([
                    ...(s.units || []),
                    ...sVideos
                      .filter(v => v.unit || v.chapter)
                      .map(v => (v.unit || v.chapter) as string),
                  ])
                );

                return (
                  <div
                    key={s.id}
                    className="subject-admin-card"
                    style={{
                      borderTop: `4px solid ${s.color || 'var(--brand)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: 220,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '0.75rem',
                        }}
                      >
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 14,
                            background: s.color || 'var(--brand)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: `0 4px 12px ${s.color || 'var(--brand)'}40`,
                          }}
                        >
                          <BookOpen size={22} />
                        </div>

                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: 'var(--bg-surface)',
                              padding: '0.2rem 0.55rem',
                              borderRadius: 20,
                              border: '1px solid var(--border)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {sVideos.length} {sVideos.length === 1 ? 'Video' : 'Videos'}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: 'rgba(59, 130, 246, 0.1)',
                              color: '#2563eb',
                              padding: '0.2rem 0.55rem',
                              borderRadius: 20,
                            }}
                          >
                            {sUnits.length} {sUnits.length === 1 ? 'Unit' : 'Units'}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: '1.05rem',
                          marginBottom: '0.25rem',
                        }}
                      >
                        {s.name}
                      </div>

                      {s.description && (
                        <div
                          style={{
                            color: 'var(--text-muted)',
                            fontSize: '0.8rem',
                            marginBottom: '0.75rem',
                            lineHeight: 1.4,
                          }}
                        >
                          {s.description}
                        </div>
                      )}

                      {/* Preview of Unit Playlists in this Subject */}
                      {sUnits.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: '0.85rem' }}>
                          {sUnits.slice(0, 3).map(u => (
                            <span
                              key={u}
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border)',
                                padding: '0.15rem 0.45rem',
                                borderRadius: 6,
                                color: 'var(--text-secondary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                            >
                              <ListVideo size={10} color="var(--brand)" /> {u}
                            </span>
                          ))}
                          {sUnits.length > 3 && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                              +{sUnits.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        borderTop: '1px solid var(--border)',
                        paddingTop: '0.75rem',
                        display: 'flex',
                        gap: '0.4rem',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{
                            fontSize: '0.76rem',
                            padding: '0.35rem 0.75rem',
                            borderRadius: 8,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          onClick={() => setSelectedSubjectForUnits(s)}
                          title="Manage Unit-wise playlists for this subject"
                        >
                          <ListVideo size={13} color="var(--brand)" /> Unit Playlists ({sUnits.length})
                        </button>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{
                            fontSize: '0.76rem',
                            padding: '0.35rem 0.75rem',
                            borderRadius: 8,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          onClick={() => openEditorForNew('link', s.id)}
                          title="Upload new video to this subject"
                        >
                          <Plus size={13} /> Upload Video
                        </button>
                      </div>

                      <button
                        className="icon-btn"
                        style={{ color: '#DC2626', fontSize: '0.8rem' }}
                        onClick={() => setDeleteTargetSubject(s)}
                        title="Delete Subject"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STATS TAB ── */}
        {!dataLoading && activeTab === 'dashboard' && (
          <div key="dashboard" className="tab-pane-content">
            <h2
              style={{
                fontSize: '1.4rem',
                fontWeight: 900,
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Layers size={22} color="var(--brand)" /> Platform Overview
            </h2>
            <div className="stats-grid">
              <div className="stat-card" style={{ borderTop: '3px solid var(--brand)' }}>
                <div className="stat-value">{stats.total_videos}</div>
                <div className="stat-label">Total Videos in Firebase</div>
              </div>
              <div className="stat-card" style={{ borderTop: '3px solid #16A34A' }}>
                <div className="stat-value" style={{ color: '#16A34A' }}>
                  {stats.published_videos}
                </div>
                <div className="stat-label">Published Live</div>
              </div>
              <div className="stat-card" style={{ borderTop: '3px solid #CA8A04' }}>
                <div className="stat-value" style={{ color: '#CA8A04' }}>
                  {stats.draft_videos}
                </div>
                <div className="stat-label">Drafts</div>
              </div>
              <div className="stat-card" style={{ borderTop: '3px solid #7C3AED' }}>
                <div className="stat-value" style={{ color: '#7C3AED' }}>
                  {stats.total_subjects}
                </div>
                <div className="stat-label">Subjects</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── VIDEO CONFIG MODAL (Clean, Focused, Exactly what user requested) ── */}
      {showEditorModal && (
        <div className="modal-overlay" onClick={() => setShowEditorModal(false)}>
          <div
            className="modal-box"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 580 }}
          >
            {/* Modal header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h3
                  style={{
                    fontWeight: 900,
                    fontSize: '1.2rem',
                    color: 'var(--brand-dark)',
                  }}
                >
                  {editingVideo ? 'Edit Video Details' : 'Configure & Publish Video'}
                </h3>
                <p
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    marginTop: 2,
                  }}
                >
                  Add video from local folder or paste an external video link (YouTube, Vimeo, MP4 URL).
                </p>
              </div>
              <button
                className="icon-btn"
                onClick={() => setShowEditorModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSaveVideo}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            >
              {/* ── VIDEO SOURCE SELECTOR: FOLDER vs LINK ── */}
              <div>
                <label className="form-label" style={{ marginBottom: '0.45rem', display: 'block' }}>
                  Choose Video Source *
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.5rem',
                    background: 'var(--bg-surface)',
                    padding: '4px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--border)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setVideoSourceMode('folder');
                      if (availableVideos.length > 0 && !formVideoUrl.startsWith('/videos/')) {
                        setFormVideoUrl(availableVideos[0].url);
                        autoDetectDuration(availableVideos[0].url);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '9px',
                      fontWeight: 800,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'all 0.15s ease',
                      background: videoSourceMode === 'folder' ? 'var(--brand)' : 'transparent',
                      color: videoSourceMode === 'folder' ? '#fff' : 'var(--text-secondary)',
                      boxShadow: videoSourceMode === 'folder' ? '0 2px 8px rgba(249, 115, 22, 0.35)' : 'none',
                    }}
                  >
                    <FolderOpen size={16} /> From Video Folder
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoSourceMode('link');
                      if (formLinkInput) {
                        setFormVideoUrl(formLinkInput.trim());
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '9px',
                      fontWeight: 800,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'all 0.15s ease',
                      background: videoSourceMode === 'link' ? 'var(--brand)' : 'transparent',
                      color: videoSourceMode === 'link' ? '#fff' : 'var(--text-secondary)',
                      boxShadow: videoSourceMode === 'link' ? '0 2px 8px rgba(249, 115, 22, 0.35)' : 'none',
                    }}
                  >
                    <Link size={16} /> By Video Link (URL)
                  </button>
                </div>
              </div>

              {/* 1A. IF FOLDER: DROP-DOWN TO SELECT VIDEO */}
              {videoSourceMode === 'folder' && (
                <div className="form-group">
                  <label
                    className="form-label"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <FileVideo size={14} color="var(--brand)" />
                      Select Video from Folder *
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--brand)' }}>
                      {availableVideos.length} found in folder
                    </span>
                  </label>

                  <select
                    className="form-input"
                    value={formVideoUrl}
                    onChange={e => {
                      setFormVideoUrl(e.target.value);
                      autoDetectDuration(e.target.value);
                    }}
                    style={{ fontWeight: 600 }}
                    required={videoSourceMode === 'folder'}
                  >
                    {availableVideos.map((item, idx) => (
                      <option key={idx} value={item.url}>
                        🎬 {item.name} ({item.source === 'firebase_storage' ? 'Firebase Storage' : 'Local/Sample'})
                      </option>
                    ))}
                  </select>

                  <div
                    style={{
                      fontSize: '0.74rem',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    <span>Selected file:</span>
                    <code
                      style={{
                        color: 'var(--brand)',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 'calc(100% - 90px)',
                      }}
                      title={decodeURIComponent(formVideoUrl.split('/').pop()?.split('?')[0] || formVideoUrl)}
                    >
                      {decodeURIComponent(formVideoUrl.split('/').pop()?.split('?')[0] || formVideoUrl)}
                    </code>
                  </div>
                </div>
              )}

              {/* 1B. IF LINK: TEXT INPUT FOR YOUTUBE / DIRECT URL */}
              {videoSourceMode === 'link' && (
                <div className="form-group">
                  <label
                    className="form-label"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Link size={14} color="var(--brand)" />
                      Paste Video Link / URL *
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--brand)', fontWeight: 600 }}>
                      YouTube, Vimeo, Drive, Direct MP4
                    </span>
                  </label>

                  <input
                    type="url"
                    className="form-input"
                    value={formLinkInput}
                    onChange={e => handleLinkInputChange(e.target.value)}
                    onPaste={e => {
                      const pasted = e.clipboardData?.getData('text');
                      if (pasted) {
                        handleLinkInputChange(pasted, true);
                      }
                    }}
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/... or .mp4 link"
                    style={{ fontWeight: 600 }}
                    required={videoSourceMode === 'link'}
                  />

                  {/* Live link feedback badge */}
                  {formLinkInput.trim() && (() => {
                    const parsed = parseVideoSource(formLinkInput.trim());
                    return (
                      <div
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.55rem 0.85rem',
                          borderRadius: 10,
                          fontSize: '0.78rem',
                          background:
                            parsed.type === 'youtube'
                              ? 'rgba(239, 68, 68, 0.08)'
                              : parsed.type === 'vimeo'
                              ? 'rgba(59, 130, 246, 0.08)'
                              : parsed.type === 'drive'
                              ? 'rgba(16, 185, 129, 0.08)'
                              : 'rgba(249, 115, 22, 0.08)',
                          border: `1.5px solid ${
                            parsed.type === 'youtube'
                              ? 'rgba(239, 68, 68, 0.3)'
                              : parsed.type === 'vimeo'
                              ? 'rgba(59, 130, 246, 0.3)'
                              : parsed.type === 'drive'
                              ? 'rgba(16, 185, 129, 0.3)'
                              : 'rgba(249, 115, 22, 0.3)'
                          }`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                        }}
                      >
                        <span style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {parsed.type === 'youtube' && '🔴 YouTube Video Detected'}
                          {parsed.type === 'vimeo' && '🔵 Vimeo Video Detected'}
                          {parsed.type === 'drive' && '🟢 Google Drive Video Detected'}
                          {parsed.type === 'direct' && '🎬 Direct Video Stream Detected'}
                        </span>
                        {fetchingTitle && (
                          <span style={{ fontSize: '0.74rem', color: 'var(--brand)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                            Auto-fetching title...
                          </span>
                        )}
                        {!fetchingTitle && autoFilledTitle && (
                          <span style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Check size={13} />
                            Title & thumbnail auto-filled
                          </span>
                        )}
                        {!fetchingTitle && !autoFilledTitle && parsed.type === 'youtube' && (
                          <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 600 }}>
                            ✓ YouTube player & thumbnail configured
                          </span>
                        )}
                        {parsed.type === 'drive' && (
                          <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                            ✓ Drive video player & preview configured
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 2. NAME / TITLE (Auto-filled from YouTube Link) */}
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Video Name / Title *</label>
                  {videoSourceMode === 'link' && formLinkInput.trim() && (
                    <button
                      type="button"
                      onClick={() => fetchVideoMetadata(formLinkInput, true)}
                      disabled={fetchingTitle}
                      style={{
                        background: 'rgba(249, 115, 22, 0.1)',
                        border: '1px solid rgba(249, 115, 22, 0.25)',
                        color: 'var(--brand)',
                        fontSize: '0.73rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 6,
                      }}
                      title="Click to re-fetch the video title from YouTube link"
                    >
                      <RefreshCw size={12} style={fetchingTitle ? { animation: 'spin 1s linear infinite' } : {}} />
                      {fetchingTitle ? 'Fetching title...' : 'Auto-fill from Link'}
                    </button>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={formTitle}
                    onChange={e => {
                      setFormTitle(e.target.value);
                      setAutoFilledTitle(false);
                    }}
                    placeholder={fetchingTitle ? 'Fetching video title from YouTube...' : 'e.g. Introduction to Physics: Chapter 1'}
                    style={autoFilledTitle ? { borderColor: '#16a34a', background: 'rgba(22, 163, 74, 0.02)' } : undefined}
                    required
                  />
                  {fetchingTitle && (
                    <div style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      color: 'var(--brand)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      pointerEvents: 'none',
                    }}>
                      <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Fetching title...</span>
                    </div>
                  )}
                </div>
                {autoFilledTitle && !fetchingTitle && (
                  <div style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={13} />
                    <span>Title auto-filled from YouTube link</span>
                  </div>
                )}
              </div>

              {/* 3. DESCRIPTION */}
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder="What will students learn in this lesson..."
                  rows={3}
                />
              </div>

              {/* 4. SUBJECT SELECTION */}
              <div className="form-group">
                <label className="form-label">Subject *</label>
                <select
                  className="form-input"
                  value={formSubjectId}
                  onChange={e => {
                    const newSubjId = e.target.value;
                    setFormSubjectId(newSubjId);
                    setFormUnit('');
                    setFormCustomUnit('');
                    setFormUnitOrder('1');
                  }}
                  required
                >
                  <option value="">— Choose a Subject —</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4b. UNIT / PLAYLIST SELECTION */}
              {formSubjectId && (
                <div
                  className="form-group"
                  style={{
                    background: 'var(--bg-surface)',
                    padding: '0.85rem 1rem',
                    borderRadius: 12,
                    border: '1.5px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <label
                      className="form-label"
                      style={{
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontWeight: 800,
                      }}
                    >
                      <ListVideo size={16} color="var(--brand)" /> Unit / Playlist (Optional)
                    </label>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Upload videos unit-wise as a playlist
                    </span>
                  </div>

                  {(() => {
                    const subjObj = subjects.find(s => s.id === formSubjectId);
                    const subjUnits = Array.from(
                      new Set([
                        ...(subjObj?.units || []),
                        ...videos
                          .filter(v => v.subject_id === formSubjectId && (v.unit || v.chapter))
                          .map(v => (v.unit || v.chapter) as string),
                      ])
                    );

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            gap: '0.5rem',
                            alignItems: 'center',
                          }}
                        >
                          <select
                            className="form-input"
                            value={formUnit}
                            onChange={e => {
                              const val = e.target.value;
                              setFormUnit(val);
                              if (val && val !== '__new__') {
                                const vidsInUnit = videos.filter(
                                  v =>
                                    v.subject_id === formSubjectId &&
                                    (v.unit === val || v.chapter === val)
                                );
                                setFormUnitOrder(String(vidsInUnit.length + 1));
                              }
                            }}
                          >
                            <option value="">— Standalone Lesson (No Unit) —</option>
                            {subjUnits.map(u => (
                              <option key={u} value={u}>
                                📑 {u}
                              </option>
                            ))}
                            <option value="__new__">+ Create New Unit / Playlist...</option>
                          </select>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            title="Playlist lesson order number (e.g. 1, 2, 3)"
                          >
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                color: 'var(--text-muted)',
                              }}
                            >
                              Lesson #
                            </span>
                            <input
                              type="number"
                              min="1"
                              className="form-input"
                              style={{ width: 60, textAlign: 'center' }}
                              value={formUnitOrder}
                              onChange={e => setFormUnitOrder(e.target.value)}
                            />
                          </div>
                        </div>

                        {formUnit === '__new__' && (
                          <div>
                            <input
                              type="text"
                              className="form-input"
                              value={formCustomUnit}
                              onChange={e => setFormCustomUnit(e.target.value)}
                              placeholder="Type new Unit name, e.g. Unit 1: Introduction or Unit 2: Kinematics"
                              autoFocus
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 5. THUMBNAIL (Image URL or File Upload) */}
              <div className="form-group">
                <label className="form-label">Thumbnail Image</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={formThumbUrl}
                    onChange={e => setFormThumbUrl(e.target.value)}
                    placeholder="Image URL or upload a file..."
                    style={{ flex: 1 }}
                  />
                  <label
                    className="btn-secondary"
                    style={{
                      cursor: 'pointer',
                      borderRadius: 12,
                      whiteSpace: 'nowrap',
                      padding: '0.55rem 0.9rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    <Upload size={13} /> Upload Image
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleThumbnailUpload}
                    />
                  </label>
                </div>

                {thumbUploading && (
                  <div
                    style={{
                      fontSize: '0.74rem',
                      color: 'var(--brand)',
                      marginTop: 4,
                    }}
                  >
                    Uploading thumbnail... {thumbProgress}%
                  </div>
                )}

                {formThumbUrl && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <img
                      src={formThumbUrl}
                      alt="Thumbnail Preview"
                      style={{
                        width: 140,
                        height: 80,
                        objectFit: 'cover',
                        borderRadius: 10,
                        border: '1.5px solid var(--border)',
                      }}
                      onError={e => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* 6. DURATION (Seconds & Presets) */}
              <div className="form-group">
                <label
                  className="form-label"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={14} color="var(--brand)" />
                    Video Duration
                  </span>
                  <span style={{ fontSize: '0.74rem', color: 'var(--brand)', fontWeight: 800 }}>
                    {(() => {
                      const sec = parseInt(formDuration, 10) || 0;
                      if (sec <= 0) return 'Default (10m)';
                      const m = Math.floor(sec / 60);
                      const s = sec % 60;
                      return `${m}m ${s > 0 ? `${s}s` : ''} (${sec}s total)`;
                    })()}
                  </span>
                </label>

                {/* Quick Presets */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  {[
                    { label: '5 min', sec: 300 },
                    { label: '10 min', sec: 600 },
                    { label: '15 min', sec: 900 },
                    { label: '20 min', sec: 1200 },
                    { label: '30 min', sec: 1800 },
                    { label: '45 min', sec: 2700 },
                    { label: '60 min', sec: 3600 },
                  ].map(preset => {
                    const isSelected = parseInt(formDuration, 10) === preset.sec;
                    return (
                      <button
                        key={preset.sec}
                        type="button"
                        onClick={() => setFormDuration(String(preset.sec))}
                        style={{
                          padding: '0.25rem 0.55rem',
                          borderRadius: 8,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: isSelected ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                          background: isSelected ? 'var(--brand-light)' : 'var(--bg-surface)',
                          color: isSelected ? 'var(--brand)' : 'var(--text-secondary)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  className="form-input"
                  value={formDuration}
                  onChange={e => {
                    const val = e.target.value.trim();
                    if (val.includes(':')) {
                      const parts = val.split(':');
                      const m = parseInt(parts[0], 10) || 0;
                      const s = parseInt(parts[1], 10) || 0;
                      setFormDuration(String(m * 60 + s));
                      return;
                    }
                    setFormDuration(val.replace(/[^0-9]/g, ''));
                  }}
                  placeholder="e.g. 600 or 10:00 (in seconds or MM:SS)"
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Tip: Choose a preset above, type total seconds (e.g. 720), or enter MM:SS (e.g. 10:00).
                </span>
              </div>

              {/* 7. STUDY MATERIAL / DOCUMENT LINK (PDF, Notes, Slides, Drive) */}
              <div className="form-group" style={{ background: 'var(--bg-surface)', padding: '0.9rem 1rem', borderRadius: 14, border: '1.5px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}>
                    <FileText size={16} color="var(--brand)" /> Study Material / Document Link (Optional)
                  </label>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    PDF, Drive, Slides, or Notes Link
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                      Material Title / Label
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={formMaterialTitle}
                      onChange={e => setFormMaterialTitle(e.target.value)}
                      placeholder="e.g. Lecture Notes PDF, Formula Sheet, Unit 1 Notes"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                      Material Link / URL
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="url"
                        className="form-input"
                        value={formMaterialUrl}
                        onChange={e => {
                          const val = e.target.value;
                          setFormMaterialUrl(val);
                          if (val && !formMaterialTitle) {
                            setFormMaterialTitle('Lecture Notes PDF');
                          }
                        }}
                        placeholder="e.g. https://drive.google.com/... or https://dropbox.com/... or PDF link"
                        style={{ flex: 1 }}
                      />
                      {formMaterialUrl && (
                        <a
                          href={formMaterialUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary"
                          style={{ textDecoration: 'none', padding: '0.55rem 0.85rem', fontSize: '0.78rem', whiteSpace: 'nowrap', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          title="Test material link in new tab"
                        >
                          <ExternalLink size={13} /> Test Link
                        </a>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Students can view or download this material directly inside the video cinema player while watching.
                  </span>
                </div>
              </div>

              {/* 8. SCHEDULED LIVE STREAM / PREMIERE */}
              <div
                style={{
                  background: formIsLive ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-surface)',
                  padding: '0.9rem 1rem',
                  borderRadius: 14,
                  border: formIsLive ? '1.5px solid rgba(239, 68, 68, 0.35)' : '1.5px solid var(--border)',
                  transition: 'all 0.2s ease',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    marginBottom: formIsLive ? '0.75rem' : 0,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formIsLive}
                    onChange={e => {
                      const checked = e.target.checked;
                      setFormIsLive(checked);
                      if (checked && !formScheduledAt) {
                        // Default to 1 hour from now formatted for datetime-local input
                        const nextHour = new Date(Date.now() + 60 * 60 * 1000);
                        const localISO = new Date(nextHour.getTime() - nextHour.getTimezoneOffset() * 60000)
                          .toISOString()
                          .slice(0, 16);
                        setFormScheduledAt(localISO);
                      }
                    }}
                    style={{ width: 17, height: 17, accentColor: '#EF4444' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Radio size={16} color={formIsLive ? '#EF4444' : 'var(--text-muted)'} />
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: formIsLive ? '#DC2626' : 'var(--text-primary)' }}>
                      Schedule as Live Stream / Premiere
                    </span>
                  </div>
                </label>

                {formIsLive && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(239, 68, 68, 0.15)' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Live Stream Start Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={formScheduledAt}
                      onChange={e => setFormScheduledAt(e.target.value)}
                      required={formIsLive}
                      style={{ background: '#FFFFFF', borderColor: '#EF4444' }}
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      A live stream countdown will be shown to students until this exact time, after which the video premieres live.
                    </span>
                  </div>
                )}
              </div>

              {/* Status toggle */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: 'var(--bg-surface)',
                  padding: '0.75rem 1rem',
                  borderRadius: 14,
                  border: '1.5px solid var(--border)',
                }}
              >
                <input
                  type="checkbox"
                  checked={formPublished}
                  onChange={e => setFormPublished(e.target.checked)}
                  style={{ width: 17, height: 17, accentColor: 'var(--brand)' }}
                />
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                  Make visible to students immediately (Status: Published)
                </span>
              </label>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'flex-end',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowEditorModal(false)}
                  style={{ borderRadius: 50 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ borderRadius: 50 }}
                >
                  <Check size={16} />{' '}
                  {editingVideo ? 'Update Video' : 'Save to Firebase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      {previewVideo && (
        <div className="modal-overlay" onClick={() => setPreviewVideo(null)}>
          <div
            className="modal-box"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 740 }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '1rem',
                alignItems: 'center',
              }}
            >
              <h3
                style={{
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Play size={17} color="var(--brand)" /> {previewVideo.title}
              </h3>
              <button className="icon-btn" onClick={() => setPreviewVideo(null)}>
                <X size={20} />
              </button>
            </div>
            {(() => {
              const parsed = parseVideoSource(previewVideo.video_url);
              if (parsed.type !== 'direct') {
                return (
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      paddingTop: '56.25%',
                      background: '#000',
                      borderRadius: 14,
                      overflow: 'hidden',
                    }}
                  >
                    <iframe
                      src={parsed.embedUrl}
                      title={previewVideo.title}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        border: 'none',
                      }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                );
              }
              return (
                <video
                  src={parsed.embedUrl || previewVideo.video_url}
                  controls
                  autoPlay
                  playsInline
                  style={{
                    width: '100%',
                    borderRadius: 14,
                    background: '#000',
                    display: 'block',
                  }}
                  onError={(e) => {
                    const target = e.currentTarget;
                    const rawUrl = (previewVideo.video_url || '').toLowerCase();
                    if (rawUrl.includes('logic') && !target.src.endsWith('/videos/logic_gates.mp4')) {
                      target.src = '/videos/logic_gates.mp4';
                      target.play().catch(() => {});
                    } else if (rawUrl.includes('junction') && !target.src.endsWith('/videos/pn_junction_diode.mp4')) {
                      target.src = '/videos/pn_junction_diode.mp4';
                      target.play().catch(() => {});
                    }
                  }}
                />
              );
            })()}
            {previewVideo.description && (
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.88rem',
                  marginTop: '1rem',
                  lineHeight: 1.6,
                }}
              >
                {previewVideo.description}
              </p>
            )}
            {(previewVideo.material_url || previewVideo.materials?.[0]?.url) && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.85rem 1rem',
                  background: 'var(--bg-surface)',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={18} color="var(--brand)" />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {previewVideo.material_title || previewVideo.materials?.[0]?.title || 'Study Material / Notes'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Attached document / download link
                    </div>
                  </div>
                </div>
                <a
                  href={previewVideo.material_url || previewVideo.materials?.[0]?.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary"
                  style={{ textDecoration: 'none', padding: '0.45rem 0.9rem', fontSize: '0.78rem', borderRadius: 50, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <ExternalLink size={13} /> View Material
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteTargetVideo && (
        <div className="modal-overlay" onClick={() => setDeleteTargetVideo(null)}>
          <div
            className="modal-box"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 400, textAlign: 'center' }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: '#FEF2F2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}
            >
              <Trash2 size={28} />
            </div>
            <h3 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>
              Delete Video?
            </h3>
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                marginBottom: '1.5rem',
                lineHeight: 1.5,
              }}
            >
              "<strong>{deleteTargetVideo.title}</strong>" will be permanently
              removed from Firebase.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                className="btn-secondary"
                onClick={() => setDeleteTargetVideo(null)}
                style={{ borderRadius: 50 }}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={handleConfirmDelete}
                style={{ borderRadius: 50 }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Subject Modal ── */}
      {showSubjectModal && (
        <div className="modal-overlay" onClick={() => setShowSubjectModal(false)}>
          <div
            className="modal-box"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 420 }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '1.5rem',
                alignItems: 'center',
              }}
            >
              <h3 style={{ fontWeight: 800 }}>Add New Subject</h3>
              <button
                className="icon-btn"
                onClick={() => setShowSubjectModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <form
              onSubmit={handleCreateSubject}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div className="form-group">
                <label className="form-label">Subject Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={subjName}
                  onChange={e => setSubjName(e.target.value)}
                  placeholder="e.g. Physics, Mathematics, Biology"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  type="text"
                  className="form-input"
                  value={subjDesc}
                  onChange={e => setSubjDesc(e.target.value)}
                  placeholder="Brief summary..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <input
                  type="color"
                  className="form-input"
                  value={subjColor}
                  onChange={e => setSubjColor(e.target.value)}
                  style={{ height: 44, padding: '0.2rem', cursor: 'pointer' }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'flex-end',
                  paddingTop: '0.5rem',
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowSubjectModal(false)}
                  style={{ borderRadius: 50 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ borderRadius: 50 }}
                >
                  <Plus size={15} /> Save Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Remove Subject Confirm ── */}
      {deleteTargetSubject && (
        <div className="modal-overlay" onClick={() => setDeleteTargetSubject(null)}>
          <div
            className="modal-box"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 380, textAlign: 'center' }}
          >
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 14,
                background: '#FEF2F2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              <Trash2 size={24} />
            </div>
            <h3 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>
              Remove Subject?
            </h3>
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
              }}
            >
              Remove "{deleteTargetSubject.name}"?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                className="btn-secondary"
                onClick={() => setDeleteTargetSubject(null)}
                style={{ borderRadius: 50 }}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={handleConfirmDeleteSubject}
                style={{ borderRadius: 50 }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Subject Units & Playlists Management Modal ── */}
      {selectedSubjectForUnits && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedSubjectForUnits(null)}
        >
          <div
            className="modal-box"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1.25rem',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '1rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: selectedSubjectForUnits.color || 'var(--brand)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BookOpen size={18} />
                  </div>
                  <h3 style={{ fontWeight: 900, fontSize: '1.25rem', margin: 0 }}>
                    {selectedSubjectForUnits.name} — Unit Playlists
                  </h3>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 4 }}>
                  Organize videos into unit playlists so students can watch them sequentially.
                </p>
              </div>
              <button
                className="icon-btn"
                onClick={() => setSelectedSubjectForUnits(null)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Add Unit Bar */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1.5px solid var(--border)',
                borderRadius: 12,
                padding: '0.85rem 1rem',
                marginBottom: '1.5rem',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
              }}
            >
              <ListVideo size={18} color="var(--brand)" />
              <input
                type="text"
                className="form-input"
                style={{ flex: 1 }}
                placeholder="Create new Unit / Playlist (e.g. Unit 1: Introduction, Unit 2: Kinematics)..."
                value={newUnitInput}
                onChange={e => setNewUnitInput(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!newUnitInput.trim()) return;
                    await addUnitToSubject(selectedSubjectForUnits.id, newUnitInput.trim());
                    showToast('success', `Unit "${newUnitInput.trim()}" created!`);
                    setNewUnitInput('');
                    loadData();
                  }
                }}
              />
              <button
                type="button"
                className="btn-primary"
                style={{ borderRadius: 8, whiteSpace: 'nowrap', padding: '0.55rem 1rem' }}
                onClick={async () => {
                  if (!newUnitInput.trim()) {
                    showToast('error', 'Please enter a unit name.');
                    return;
                  }
                  await addUnitToSubject(selectedSubjectForUnits.id, newUnitInput.trim());
                  showToast('success', `Unit "${newUnitInput.trim()}" created!`);
                  setNewUnitInput('');
                  loadData();
                }}
              >
                <Plus size={15} /> Add Unit
              </button>
            </div>

            {/* Units List */}
            {(() => {
              const subjVideos = videos.filter(v => v.subject_id === selectedSubjectForUnits.id);
              const allUnitsForSubj = Array.from(
                new Set([
                  ...(selectedSubjectForUnits.units || []),
                  ...subjVideos
                    .filter(v => v.unit || v.chapter)
                    .map(v => (v.unit || v.chapter) as string),
                ])
              );
              const unassignedVideos = subjVideos.filter(v => !v.unit && !v.chapter);

              if (allUnitsForSubj.length === 0 && unassignedVideos.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    <ListVideo size={44} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>No Unit Playlists Yet</div>
                    <div style={{ fontSize: '0.82rem', marginTop: 4 }}>
                      Type a unit name above or click below to upload your first video.
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ marginTop: '1rem', borderRadius: 50 }}
                      onClick={() => {
                        setSelectedSubjectForUnits(null);
                        openEditorForNew('link', selectedSubjectForUnits.id);
                      }}
                    >
                      <Plus size={14} /> Upload First Video
                    </button>
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {allUnitsForSubj.map(unitName => {
                    const unitVideos = subjVideos
                      .filter(v => v.unit === unitName || v.chapter === unitName)
                      .sort((a, b) => (a.unit_order || 1) - (b.unit_order || 1));
                    const totalDur = unitVideos.reduce((acc, v) => acc + (v.duration || 600), 0);

                    return (
                      <div
                        key={unitName}
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1.5px solid var(--border)',
                          borderRadius: 14,
                          padding: '1rem 1.25rem',
                        }}
                      >
                        {/* Unit Header */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '0.5rem',
                            marginBottom: unitVideos.length > 0 ? '0.85rem' : 0,
                            paddingBottom: unitVideos.length > 0 ? '0.65rem' : 0,
                            borderBottom: unitVideos.length > 0 ? '1px solid var(--border)' : 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span
                              style={{
                                background: 'rgba(59, 130, 246, 0.12)',
                                color: '#2563eb',
                                fontWeight: 900,
                                fontSize: '0.8rem',
                                padding: '0.2rem 0.55rem',
                                borderRadius: 6,
                              }}
                            >
                              Unit Playlist
                            </span>
                            <span style={{ fontWeight: 800, fontSize: '1rem' }}>{unitName}</span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              ({unitVideos.length} {unitVideos.length === 1 ? 'lesson' : 'lessons'} • {fmtDur(totalDur)})
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn-primary"
                              style={{
                                fontSize: '0.74rem',
                                padding: '0.3rem 0.7rem',
                                borderRadius: 6,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                              onClick={() => {
                                setSelectedSubjectForUnits(null);
                                openEditorForNew('link', selectedSubjectForUnits.id, unitName);
                              }}
                              title="Upload another video directly to this unit"
                            >
                              <Plus size={12} /> Add Video to Unit
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              style={{ color: '#DC2626', fontSize: '0.74rem' }}
                              onClick={async () => {
                                if (
                                  confirm(
                                    `Remove unit "${unitName}"? Existing videos will stay in subject as unassigned.`
                                  )
                                ) {
                                  await removeUnitFromSubject(selectedSubjectForUnits.id, unitName);
                                  showToast('success', `Unit "${unitName}" removed.`);
                                  loadData();
                                }
                              }}
                              title="Delete Unit"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Videos in this unit */}
                        {unitVideos.length === 0 ? (
                          <div
                            style={{
                              fontSize: '0.8rem',
                              color: 'var(--text-muted)',
                              padding: '0.75rem 0',
                              textAlign: 'center',
                            }}
                          >
                            No videos in this unit yet.{' '}
                            <button
                              type="button"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--brand)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                              onClick={() => {
                                setSelectedSubjectForUnits(null);
                                openEditorForNew('link', selectedSubjectForUnits.id, unitName);
                              }}
                            >
                              Click here to upload/link a video to this unit
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {unitVideos.map((v, idx) => (
                              <div
                                key={v.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  background: 'var(--bg-primary)',
                                  padding: '0.5rem 0.75rem',
                                  borderRadius: 8,
                                  border: '1px solid var(--border)',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <span
                                    style={{
                                      fontSize: '0.75rem',
                                      fontWeight: 800,
                                      color: 'var(--text-muted)',
                                      width: 22,
                                    }}
                                  >
                                    #{v.unit_order || idx + 1}
                                  </span>
                                  {v.thumbnail_url && !v.thumbnail_url.includes('unsplash.com') ? (
                                    <img
                                      src={v.thumbnail_url}
                                      alt={v.title}
                                      style={{
                                        width: 52,
                                        height: 32,
                                        objectFit: 'cover',
                                        borderRadius: 6,
                                        border: '1px solid var(--border)',
                                      }}
                                      onError={e => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        width: 52,
                                        height: 32,
                                        borderRadius: 6,
                                        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#93C5FD',
                                        fontSize: '0.55rem',
                                        fontWeight: 700,
                                      }}
                                    >
                                      LEC
                                    </div>
                                  )}
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{v.title}</div>
                                    <div
                                      style={{
                                        fontSize: '0.72rem',
                                        color: 'var(--text-muted)',
                                        display: 'flex',
                                        gap: 8,
                                      }}
                                    >
                                      <span>⏱ {fmtDur(v.duration || 600)}</span>
                                      <span>👁 {v.views ?? 0} views</span>
                                      <span className={`status-pill ${v.status}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                                        {v.status}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button
                                    className="icon-btn"
                                    title="Preview"
                                    onClick={() => setPreviewVideo(v)}
                                    style={{ color: '#0EA5E9' }}
                                  >
                                    <Play size={13} />
                                  </button>
                                  <button
                                    className="icon-btn"
                                    title="Edit"
                                    onClick={() => {
                                      setSelectedSubjectForUnits(null);
                                      openEditorForEdit(v);
                                    }}
                                    style={{ color: 'var(--brand)' }}
                                  >
                                    <Edit size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Unassigned Videos */}
                  {unassignedVideos.length > 0 && (
                    <div
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1.5px dashed var(--border)',
                        borderRadius: 14,
                        padding: '1rem 1.25rem',
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                        Unassigned Lessons in Subject ({unassignedVideos.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {unassignedVideos.map(v => (
                          <div
                            key={v.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: 'var(--bg-primary)',
                              padding: '0.45rem 0.65rem',
                              borderRadius: 8,
                              border: '1px solid var(--border)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              {v.thumbnail_url && !v.thumbnail_url.includes('unsplash.com') ? (
                                <img
                                  src={v.thumbnail_url}
                                  alt={v.title}
                                  style={{
                                    width: 48,
                                    height: 30,
                                    objectFit: 'cover',
                                    borderRadius: 6,
                                  }}
                                  onError={e => {
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 48,
                                    height: 30,
                                    borderRadius: 6,
                                    background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#93C5FD',
                                    fontSize: '0.52rem',
                                    fontWeight: 700,
                                  }}
                                >
                                  LEC
                                </div>
                              )}
                              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{v.title}</span>
                            </div>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ fontSize: '0.74rem', padding: '0.25rem 0.6rem', borderRadius: 6 }}
                              onClick={() => {
                                setSelectedSubjectForUnits(null);
                                openEditorForEdit(v);
                              }}
                            >
                              Assign to Unit
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

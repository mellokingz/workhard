/**
 * Nexus Study — Frontend API Client
 * Drop this file into your Next.js project at: lib/api.js
 * 
 * Usage:
 *   import api from '@/lib/api'
 *   const { data } = await api.auth.login({ email, password })
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ─── HTTP CORE ────────────────────────────────────────────────────────────────

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this._token = null;
  }

  setToken(token) { this._token = token; }
  clearToken()    { this._token = null; }

  _getHeaders(extra = {}) {
    const headers = { 'Content-Type': 'application/json', ...extra };
    if (this._token) headers['Authorization'] = `Bearer ${this._token}`;
    return headers;
  }

  async _request(method, path, body = null, opts = {}) {
    const url = `${this.baseUrl}${path}`;
    const config = {
      method,
      headers: this._getHeaders(opts.headers),
      credentials: 'include',
    };

    if (body && !(body instanceof FormData)) {
      config.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      // Let browser set Content-Type with boundary for multipart
      const { 'Content-Type': _, ...rest } = config.headers;
      config.headers = rest;
      config.body = body;
    }

    const res = await fetch(url, config);
    const contentType = res.headers.get('content-type');
    const data = contentType?.includes('application/json') ? await res.json() : null;

    if (!res.ok) {
      const error = new Error(data?.error || `HTTP ${res.status}`);
      error.status = res.status;
      error.code = data?.code;
      error.data = data;
      throw error;
    }

    return data;
  }

  get(path, params)         { return this._request('GET',    params ? `${path}?${new URLSearchParams(params)}` : path); }
  post(path, body, opts)    { return this._request('POST',   path, body, opts); }
  patch(path, body)         { return this._request('PATCH',  path, body); }
  delete(path, body)        { return this._request('DELETE', path, body); }
}

const http = new ApiClient(BASE_URL);

// ─── AUTH ──────────────────────────────────────────────────────────────────────
export const auth = {
  register: (data) => http.post('/auth/register', data),
  login:    (data) => http.post('/auth/login', data),
  logout:   ()     => http.post('/auth/logout'),
  logoutAll:()     => http.post('/auth/logout-all'),
  me:       ()     => http.get('/auth/me'),

  /** Call after login to persist token for subsequent requests */
  setToken: (token) => http.setToken(token),
  clearToken: ()    => http.clearToken(),
};

// ─── NOTES ────────────────────────────────────────────────────────────────────
export const notes = {
  list: (params) => http.get('/notes', params),
  get:  (id) =>    http.get(`/notes/${id}`),
  status: (id) =>  http.get(`/notes/${id}/status`),

  /** Create from pasted text */
  create: (data) => http.post('/notes', data),

  /** Upload a file (PDF, TXT, MD) */
  upload: (file, meta = {}) => {
    const form = new FormData();
    form.append('file', file);
    Object.entries(meta).forEach(([k, v]) => {
      form.append(k, typeof v === 'object' ? JSON.stringify(v) : v);
    });
    return http.post('/notes/upload', form);
  },

  update: (id, data) =>    http.patch(`/notes/${id}`, data),
  delete: (id) =>          http.delete(`/notes/${id}`),
  regenerate: (id, opts) => http.post(`/notes/${id}/regenerate`, { generate: opts }),

  /** Poll status until AI generation is complete */
  pollStatus: (id, onUpdate, intervalMs = 2000) => {
    const poll = setInterval(async () => {
      try {
        const res = await notes.status(id);
        onUpdate(res.data.status);
        if (['COMPLETE', 'FAILED'].includes(res.data.status.aiStatus)) {
          clearInterval(poll);
        }
      } catch (_) { clearInterval(poll); }
    }, intervalMs);
    return () => clearInterval(poll);
  },
};

// ─── FLASHCARDS ───────────────────────────────────────────────────────────────
export const flashcards = {
  sets:        ()       => http.get('/flashcards/sets'),
  set:         (setId)  => http.get(`/flashcards/sets/${setId}`),
  byNote:      (noteId) => http.get(`/flashcards/note/${noteId}`),
  due:         (limit)  => http.get('/flashcards/due', limit ? { limit } : undefined),
  mastery:     ()       => http.get('/flashcards/mastery'),

  /** Rate a card: rating = 'HARD' | 'OK' | 'EASY' */
  rate: (cardId, rating, timeSpentMs) =>
    http.post(`/flashcards/cards/${cardId}/rate`, { rating, timeSpentMs }),
};

// ─── QUIZ ─────────────────────────────────────────────────────────────────────
export const quiz = {
  list:      ()           => http.get('/quiz'),
  get:       (quizId)     => http.get(`/quiz/${quizId}`),
  byNote:    (noteId)     => http.get(`/quiz/note/${noteId}`),
  history:   (quizId)     => http.get(`/quiz/${quizId}/history`),

  /** answers: [{ questionId, answer (index), timeSpentMs? }] */
  submit: (quizId, answers, timeTakenMs) =>
    http.post(`/quiz/${quizId}/attempt`, { answers, timeTakenMs }),
};

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
export const summary = {
  get:    (summaryId) => http.get(`/summary/${summaryId}`),
  byNote: (noteId)    => http.get(`/summary/note/${noteId}`),
};

// ─── CHAT ─────────────────────────────────────────────────────────────────────
export const chat = {
  /** Send a message. history = [{ role, content }] */
  send: (message, history = [], noteId = null) =>
    http.post('/chat/message', { message, history, noteId }),

  explain: (concept, noteId = null) =>
    http.post('/chat/explain', { concept, noteId }),
};

// ─── PROGRESS ─────────────────────────────────────────────────────────────────
export const progress = {
  dashboard: ()       => http.get('/progress/dashboard'),
  activity:  ()       => http.get('/progress/activity'),

  /** Log a completed study session */
  logSession: (type, durationMs, cardsReviewed = 0, noteId = null) =>
    http.post('/progress/session', { type, durationMs, cardsReviewed, noteId }),
};

// ─── USERS ────────────────────────────────────────────────────────────────────
export const users = {
  updateProfile:  (data) => http.patch('/users/profile', data),
  updateSettings: (data) => http.patch('/users/settings', data),
  changePassword: (data) => http.post('/users/change-password', data),
  deleteAccount:  (data) => http.delete('/users/account', data),
};

// ─── HEALTH ───────────────────────────────────────────────────────────────────
export const health = () => http.get('/health');

// ─── DEFAULT EXPORT ───────────────────────────────────────────────────────────
const api = { auth, notes, flashcards, quiz, summary, chat, progress, users, health };
export default api;

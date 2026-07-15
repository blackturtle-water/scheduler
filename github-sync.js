/**
 * GitHub Gist Sync Module - FINAL SAFE VERSION
 * Uses GitHub Secret Gist as lightweight cloud DB.
 */
const GithubSync = {
  KEYS: {
    PAT: 'gs_github_pat',
    GIST_ID: 'gs_github_gist_id',
    LAST_SYNC: 'gs_last_sync_time'
  },
  FILE_NAME: 'scheduler-data.json',
  LEGACY_FILE_NAMES: ['g-scheduler-data.json', 'gscheduler-data.json', 'G-Scheduler Sync Data.json'],
  GIST_DESCRIPTION: 'G-Scheduler Sync Data',

  getSettings() {
    return {
      pat: localStorage.getItem(this.KEYS.PAT) || '',
      gistId: localStorage.getItem(this.KEYS.GIST_ID) || ''
    };
  },

  saveSettings(pat, gistId = '') {
    if (pat && String(pat).trim()) localStorage.setItem(this.KEYS.PAT, String(pat).trim());
    if (gistId && String(gistId).trim()) localStorage.setItem(this.KEYS.GIST_ID, String(gistId).trim());
  },

  clearSettings() {
    localStorage.removeItem(this.KEYS.PAT);
    localStorage.removeItem(this.KEYS.GIST_ID);
    localStorage.removeItem(this.KEYS.LAST_SYNC);
  },

  isConfigured() {
    return !!this.getSettings().pat;
  },

  async request(url, options = {}) {
    const { pat } = this.getSettings();
    if (!pat) throw new Error('PAT가 저장되지 않았습니다.');
    const res = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${pat}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {})
      }
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = data && data.message ? data.message : `HTTP ${res.status}`;
      throw new Error(`GitHub API 오류: ${msg}`);
    }
    return data;
  },

  findDataFile(gist) {
    if (!gist || !gist.files) return null;
    if (gist.files[this.FILE_NAME]) return gist.files[this.FILE_NAME];
    for (const name of this.LEGACY_FILE_NAMES) {
      if (gist.files[name]) return gist.files[name];
    }
    return Object.values(gist.files).find(f => f.filename && f.filename.toLowerCase().endsWith('.json')) || null;
  },

  async createGist(data) {
    const body = {
      description: this.GIST_DESCRIPTION,
      public: false,
      files: {
        [this.FILE_NAME]: { content: JSON.stringify(data || {}, null, 2) }
      }
    };
    const gist = await this.request('https://api.github.com/gists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (gist?.id) localStorage.setItem(this.KEYS.GIST_ID, gist.id);
    return gist;
  },

  async getGist() {
    const { gistId } = this.getSettings();
    if (!gistId) return null;
    return await this.request(`https://api.github.com/gists/${gistId}`);
  },

  async downloadData() {
    const { gistId } = this.getSettings();
    if (!gistId) return null;
    const gist = await this.getGist();
    const file = this.findDataFile(gist);
    if (!file || !file.content) return null;
    try {
      return JSON.parse(file.content);
    } catch {
      throw new Error('Gist 데이터 JSON 파싱 실패');
    }
  },

  async uploadData(data) {
    const { gistId } = this.getSettings();
    if (!gistId) return await this.createGist(data);
    const body = {
      description: this.GIST_DESCRIPTION,
      files: {
        [this.FILE_NAME]: { content: JSON.stringify(data || {}, null, 2) }
      }
    };
    return await this.request(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
};

const AutoSync = {
  _uploadTimer: null,
  _debounceMs: 2000,
  _isSyncing: false,
  scheduleUpload() {
    // 안전 동기화 버전에서는 자동 업로드를 비활성화합니다.
    // 데이터 꼬임 방지를 위해 사용자가 [클라우드 업로드]를 직접 누르는 구조입니다.
  }
};

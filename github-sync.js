/**
 * GitHub Gist Sync Module - robust PC/mobile version
 * - Uses GitHub Secret Gist as cloud storage
 * - Supports old/new data file names for compatibility
 * - PAT is stored only in browser localStorage via settings screen
 */

const GithubSync = {
    KEYS: {
        PAT: 'gs_github_pat',
        GIST_ID: 'gs_github_gist_id',
        LAST_SYNC: 'gs_last_sync_time'
    },

    FILE_NAME: 'scheduler-data.json',
    LEGACY_FILE_NAMES: ['scheduler-data.json', 'g-scheduler-data.json'],
    GIST_DESCRIPTION: 'G-Scheduler Sync Data',

    getSettings() {
        return {
            pat: localStorage.getItem(this.KEYS.PAT) || '',
            gistId: localStorage.getItem(this.KEYS.GIST_ID) || '',
            lastSync: localStorage.getItem(this.KEYS.LAST_SYNC) || ''
        };
    },

    saveSettings(pat, gistId) {
        if (pat) localStorage.setItem(this.KEYS.PAT, pat.trim());
        else localStorage.removeItem(this.KEYS.PAT);

        if (gistId) localStorage.setItem(this.KEYS.GIST_ID, gistId.trim());
        else localStorage.removeItem(this.KEYS.GIST_ID);
    },

    isConfigured() {
        return !!this.getSettings().pat;
    },

    getHeaders(pat) {
        return {
            'Authorization': `token ${pat}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json'
        };
    },

    async _request(url, options = {}) {
        const settings = this.getSettings();
        if (!settings.pat) throw new Error('GitHub PAT가 설정되지 않았습니다.');

        const response = await fetch(url, {
            ...options,
            headers: {
                ...this.getHeaders(settings.pat),
                ...(options.headers || {})
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const msg = errorData.message || `${response.status} ${response.statusText}`;
            if (response.status === 401) throw new Error('401 인증 실패: PAT가 틀렸거나 만료되었습니다.');
            if (response.status === 403) throw new Error('403 권한 오류: PAT에 gist 권한이 있는지 확인하세요.');
            if (response.status === 404) throw new Error('404 Gist 오류: Gist ID가 틀렸거나 토큰이 해당 Gist에 접근할 수 없습니다.');
            throw new Error(`GitHub API 오류: ${msg}`);
        }

        return await response.json();
    },

    _findDataFile(files) {
        if (!files) return null;
        for (const name of this.LEGACY_FILE_NAMES) {
            if (files[name]) return files[name];
        }
        return null;
    },

    async findExistingGist() {
        const gists = await this._request('https://api.github.com/gists', { method: 'GET' });
        const found = gists.find(gist => {
            const hasKnownFile = gist.files && this.LEGACY_FILE_NAMES.some(name => gist.files[name]);
            const sameDesc = gist.description === this.GIST_DESCRIPTION;
            return hasKnownFile || sameDesc;
        });

        if (found) {
            localStorage.setItem(this.KEYS.GIST_ID, found.id);
            return found.id;
        }
        return '';
    },

    async uploadData(data) {
        const settings = this.getSettings();
        if (!settings.pat) throw new Error('GitHub PAT가 설정되지 않았습니다.');

        let gistId = settings.gistId;
        if (!gistId) gistId = await this.findExistingGist();

        const body = {
            description: this.GIST_DESCRIPTION,
            public: false,
            files: {
                [this.FILE_NAME]: {
                    content: JSON.stringify({
                        app: 'G-Scheduler',
                        updatedAt: new Date().toISOString(),
                        data
                    }, null, 2)
                }
            }
        };

        const url = gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists';
        const method = gistId ? 'PATCH' : 'POST';
        const result = await this._request(url, { method, body: JSON.stringify(body) });

        localStorage.setItem(this.KEYS.GIST_ID, result.id);
        const now = new Date().toISOString();
        localStorage.setItem(this.KEYS.LAST_SYNC, now);
        return { success: true, gistId: result.id, updatedAt: now };
    },

    async downloadData() {
        let settings = this.getSettings();
        if (!settings.pat) throw new Error('GitHub PAT가 설정되지 않았습니다.');

        let gistId = settings.gistId;
        if (!gistId) gistId = await this.findExistingGist();
        if (!gistId) return { success: false, data: null, message: '동기화용 Gist가 없습니다.' };

        const gist = await this._request(`https://api.github.com/gists/${gistId}`, { method: 'GET' });
        localStorage.setItem(this.KEYS.GIST_ID, gist.id);

        const file = this._findDataFile(gist.files);
        if (!file || !file.content) return { success: false, data: null, message: 'Gist에 데이터 파일이 없습니다.' };

        let parsed = JSON.parse(file.content);
        const data = parsed && parsed.data ? parsed.data : parsed;
        const remoteUpdatedAt = parsed && parsed.updatedAt ? parsed.updatedAt : (gist.updated_at || '');

        const now = new Date().toISOString();
        localStorage.setItem(this.KEYS.LAST_SYNC, now);
        return { success: true, data, updatedAt: now, remoteUpdatedAt, gistId: gist.id };
    }
};

const AutoSync = {
    _uploadTimer: null,
    _debounceMs: 2000,
    _isSyncing: false,

    scheduleUpload(data) {
        if (!GithubSync.isConfigured()) return;
        if (this._uploadTimer) clearTimeout(this._uploadTimer);
        this._uploadTimer = setTimeout(async () => {
            if (this._isSyncing) return;
            this._isSyncing = true;
            try {
                setMobileSyncStatus('자동 업로드 중...', 'syncing');
                await GithubSync.uploadData(data);
                setMobileSyncStatus('자동 업로드 완료', 'online');
                if (typeof updateSyncIndicator === 'function') updateSyncIndicator();
                if (typeof renderSyncLogBox === 'function') renderSyncLogBox();
            } catch (e) {
                setMobileSyncStatus(`자동 업로드 실패: ${e.message}`, 'error');
                console.warn('[AutoSync] 자동 업로드 실패:', e.message);
            } finally {
                this._isSyncing = false;
            }
        }, this._debounceMs);
    }
};

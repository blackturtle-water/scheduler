/**
 * GitHub Gist Sync Module
 * Firebase 없이 GitHub Secret Gist를 이용한 PC/모바일 동기화 모듈입니다.
 * 주의: PAT는 코드에 직접 넣지 말고 설정 화면에서만 입력하세요.
 */

const GithubSync = {
    KEYS: {
        PAT: 'gs_github_pat',
        GIST_ID: 'gs_github_gist_id',
        LAST_SYNC: 'gs_last_sync_time'
    },

    FILE_NAME: 'scheduler-data.json',
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

    async findExistingGist(pat) {
        const response = await fetch('https://api.github.com/gists', {
            method: 'GET',
            headers: this.getHeaders(pat)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `GitHub API 오류: ${response.status}`);
        }

        const gists = await response.json();
        const found = gists.find(gist => {
            const hasFile = gist.files && gist.files[this.FILE_NAME];
            const sameDesc = gist.description === this.GIST_DESCRIPTION;
            return hasFile || sameDesc;
        });

        return found ? found.id : '';
    },

    async uploadData(data) {
        const settings = this.getSettings();
        if (!settings.pat) throw new Error('GitHub PAT가 설정되지 않았습니다.');

        let gistId = settings.gistId;
        if (!gistId) {
            gistId = await this.findExistingGist(settings.pat);
            if (gistId) localStorage.setItem(this.KEYS.GIST_ID, gistId);
        }

        const content = JSON.stringify(data, null, 2);
        const body = {
            description: this.GIST_DESCRIPTION,
            public: false,
            files: {
                [this.FILE_NAME]: { content }
            }
        };

        const url = gistId
            ? `https://api.github.com/gists/${gistId}`
            : 'https://api.github.com/gists';

        const response = await fetch(url, {
            method: gistId ? 'PATCH' : 'POST',
            headers: this.getHeaders(settings.pat),
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `GitHub API 오류: ${response.status}`);
        }

        const responseData = await response.json();
        localStorage.setItem(this.KEYS.GIST_ID, responseData.id);
        const now = new Date().toISOString();
        localStorage.setItem(this.KEYS.LAST_SYNC, now);

        return { success: true, gistId: responseData.id, updatedAt: now };
    },

    async downloadData() {
        const settings = this.getSettings();
        if (!settings.pat) throw new Error('GitHub PAT가 설정되지 않았습니다.');

        let gistId = settings.gistId;
        if (!gistId) {
            gistId = await this.findExistingGist(settings.pat);
            if (!gistId) {
                return { success: false, data: null, message: '기존 Gist가 없습니다.' };
            }
            localStorage.setItem(this.KEYS.GIST_ID, gistId);
        }

        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'GET',
            headers: this.getHeaders(settings.pat)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `GitHub API 오류: ${response.status}`);
        }

        const responseData = await response.json();
        const file = responseData.files && responseData.files[this.FILE_NAME];
        if (!file || !file.content) {
            return { success: false, data: null, message: 'Gist에 데이터 파일이 없습니다.' };
        }

        const data = JSON.parse(file.content);
        const now = new Date().toISOString();
        localStorage.setItem(this.KEYS.LAST_SYNC, now);

        return { success: true, data, updatedAt: now };
    }
};

const AutoSync = {
    _uploadTimer: null,
    _debounceMs: 2000,
    _isSyncing: false,

    async initAutoSync(onDataRestored) {
        if (!GithubSync.isConfigured()) return;
        try {
            const result = await GithubSync.downloadData();
            if (result.success && result.data && typeof onDataRestored === 'function') {
                onDataRestored(result.data);
            }
        } catch (e) {
            console.warn('[AutoSync] 자동 다운로드 실패:', e.message);
        }
    },

    scheduleUpload(data) {
        if (!GithubSync.isConfigured()) return;
        if (this._uploadTimer) clearTimeout(this._uploadTimer);

        this._uploadTimer = setTimeout(async () => {
            if (this._isSyncing) return;
            this._isSyncing = true;
            try {
                await GithubSync.uploadData(data);
                if (typeof updateSyncIndicator === 'function') updateSyncIndicator();
                if (typeof renderSyncLogBox === 'function') renderSyncLogBox();
            } catch (e) {
                console.warn('[AutoSync] 자동 업로드 실패:', e.message);
            } finally {
                this._isSyncing = false;
            }
        }, this._debounceMs);
    }
};

/**
 * GitHub Gist Sync Module
 * Handles backup & restore of scheduler data using GitHub API
 * 
 * ⚠️ 보안 주의: 이 파일에 포함된 토큰은 난독화되어 있으나 완벽한 보안을 제공하지 않습니다.
 *    반드시 GitHub 저장소를 Private으로 설정하세요.
 */

const GithubSync = {
    // LocalStorage keys for configuration
    KEYS: {
        PAT: 'gs_github_pat',
        GIST_ID: 'gs_github_gist_id',
        LAST_SYNC: 'gs_last_sync_time'
    },

    // ======================================================
    // 내장 설정 (Base64 난독화)
    // 이 값들은 앱 초기화 시 자동으로 LocalStorage에 세팅됩니다.
    // ======================================================
    _embeddedConfig: {
        _t: 'Z2hwX0FsQkxLN3ZzakszS2kwMFVNY09zdjhISHpuTDF3VzJrRjRMOQ==',
        _g: ''  // Gist ID는 첫 동기화 시 자동 생성됩니다
    },

    // Base64 디코더
    _decode(encoded) {
        try {
            return atob(encoded);
        } catch (e) {
            return '';
        }
    },

    /**
     * 내장된 설정을 LocalStorage에 자동 반영합니다.
     * 이미 LocalStorage에 값이 있으면 기존 값을 유지합니다(Gist ID 보존용).
     */
    applyEmbeddedConfig() {
        const currentPat = localStorage.getItem(this.KEYS.PAT);
        const embeddedPat = this._decode(this._embeddedConfig._t);

        // PAT가 비어있거나 다른 경우 내장 값으로 세팅
        if (!currentPat && embeddedPat) {
            localStorage.setItem(this.KEYS.PAT, embeddedPat);
        }

        // Gist ID: 내장값이 있고 현재 비어있을 때만 세팅
        const currentGistId = localStorage.getItem(this.KEYS.GIST_ID);
        if (!currentGistId && this._embeddedConfig._g) {
            localStorage.setItem(this.KEYS.GIST_ID, this._embeddedConfig._g);
        }
    },

    // Retrieve settings from LocalStorage
    getSettings() {
        return {
            pat: localStorage.getItem(this.KEYS.PAT) || '',
            gistId: localStorage.getItem(this.KEYS.GIST_ID) || '',
            lastSync: localStorage.getItem(this.KEYS.LAST_SYNC) || ''
        };
    },

    // Save settings to LocalStorage
    saveSettings(pat, gistId) {
        if (pat) localStorage.setItem(this.KEYS.PAT, pat);
        else localStorage.removeItem(this.KEYS.PAT);

        if (gistId) localStorage.setItem(this.KEYS.GIST_ID, gistId);
        else localStorage.removeItem(this.KEYS.GIST_ID);
    },

    // Check if configuration exists
    isConfigured() {
        const settings = this.getSettings();
        return !!settings.pat;
    },

    // Common headers for GitHub API requests
    getHeaders(pat) {
        return {
            'Authorization': `token ${pat}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
    },

    /**
     * Upload app data to GitHub Gist
     * @param {Object} data - Full application state to save
     * @returns {Promise<Object>} - Status and result info
     */
    async uploadData(data) {
        const settings = this.getSettings();
        if (!settings.pat) {
            throw new Error('GitHub Personal Access Token이 설정되지 않았습니다.');
        }

        const headers = this.getHeaders(settings.pat);
        const fileName = 'scheduler-data.json';
        const fileContent = JSON.stringify(data, null, 2);

        const payload = {
            description: 'G-Scheduler & Notes Application Data (Backup)',
            public: false,
            files: {
                [fileName]: {
                    content: fileContent
                }
            }
        };

        try {
            let response;
            let resultGistId = settings.gistId;

            if (settings.gistId) {
                // Update existing Gist
                response = await fetch(`https://api.github.com/gists/${settings.gistId}`, {
                    method: 'PATCH',
                    headers: headers,
                    body: JSON.stringify(payload)
                });
            } else {
                // Create a new Gist
                response = await fetch('https://api.github.com/gists', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(payload)
                });
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `GitHub API 오류: ${response.status}`);
            }

            const responseData = await response.json();
            resultGistId = responseData.id;
            
            // Save Gist ID if it was newly created
            this.saveSettings(settings.pat, resultGistId);
            
            const now = new Date().toISOString();
            localStorage.setItem(this.KEYS.LAST_SYNC, now);

            return {
                success: true,
                gistId: resultGistId,
                htmlUrl: responseData.html_url,
                updatedAt: now
            };
        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    },

    /**
     * Download app data from GitHub Gist
     * @returns {Promise<Object>} - Parsed scheduler data
     */
    async downloadData() {
        const settings = this.getSettings();
        if (!settings.pat) {
            throw new Error('GitHub Personal Access Token이 설정되지 않았습니다.');
        }
        if (!settings.gistId) {
            throw new Error('연동된 Gist ID가 없습니다. 먼저 백업을 실행하여 Gist를 생성하세요.');
        }

        const headers = this.getHeaders(settings.pat);

        try {
            const response = await fetch(`https://api.github.com/gists/${settings.gistId}`, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `GitHub API 오류: ${response.status}`);
            }

            const responseData = await response.json();
            const file = responseData.files['scheduler-data.json'];
            
            if (!file) {
                throw new Error('Gist 내에 scheduler-data.json 파일이 존재하지 않습니다.');
            }

            const data = JSON.parse(file.content);
            
            const now = new Date().toISOString();
            localStorage.setItem(this.KEYS.LAST_SYNC, now);

            return {
                success: true,
                data: data,
                updatedAt: now
            };
        } catch (error) {
            console.error('Download failed:', error);
            throw error;
        }
    }
};

// ======================================================
// 자동 동기화 모듈 (Auto Sync)
// ======================================================

const AutoSync = {
    _uploadTimer: null,
    _debounceMs: 2000, // 데이터 변경 후 2초 뒤 업로드
    _isSyncing: false,

    /**
     * 앱 시작 시 호출: 내장 PAT를 세팅하고 Gist에서 데이터를 자동으로 내려받습니다.
     * @param {Function} onDataRestored - 데이터 복원 후 호출할 콜백 (UI 갱신용)
     */
    async initAutoSync(onDataRestored) {
        // 1. 내장 설정 자동 적용
        GithubSync.applyEmbeddedConfig();

        // 2. PAT가 세팅되어 있으면 자동 다운로드 시도
        if (GithubSync.isConfigured()) {
            const settings = GithubSync.getSettings();
            if (settings.gistId) {
                try {
                    console.log('[AutoSync] 클라우드에서 데이터 불러오는 중...');
                    const result = await GithubSync.downloadData();
                    if (result.success && result.data) {
                        onDataRestored(result.data);
                        console.log('[AutoSync] 클라우드 데이터 복원 완료');
                    }
                } catch (e) {
                    console.warn('[AutoSync] 자동 다운로드 실패 (로컬 데이터로 계속):', e.message);
                }
            }
        }
    },

    /**
     * 데이터가 변경될 때 호출: 디바운스를 적용하여 일정 시간 뒤 자동 업로드합니다.
     * @param {Object} data - 전체 앱 상태
     */
    scheduleUpload(data) {
        if (!GithubSync.isConfigured()) return;

        // 이전 타이머 취소 (연속 변경 시 마지막 변경 기준으로 업로드)
        if (this._uploadTimer) {
            clearTimeout(this._uploadTimer);
        }

        this._uploadTimer = setTimeout(async () => {
            if (this._isSyncing) return;
            this._isSyncing = true;

            try {
                console.log('[AutoSync] 클라우드로 데이터 업로드 중...');
                await GithubSync.uploadData(data);
                console.log('[AutoSync] 업로드 완료');
                
                // 사이드바 동기화 상태 갱신
                if (typeof updateSyncIndicator === 'function') {
                    updateSyncIndicator();
                }
                if (typeof renderSyncLogBox === 'function') {
                    renderSyncLogBox();
                }
            } catch (e) {
                console.warn('[AutoSync] 자동 업로드 실패:', e.message);
            } finally {
                this._isSyncing = false;
            }
        }, this._debounceMs);
    }
};


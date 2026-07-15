/**
 * GitHub Gist Sync Module
 * Handles backup & restore of scheduler data using GitHub API
 */

const GithubSync = {
    // LocalStorage keys for configuration
    KEYS: {
        PAT: 'gs_github_pat',
        GIST_ID: 'gs_github_gist_id',
        LAST_SYNC: 'gs_last_sync_time'
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

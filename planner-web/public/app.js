const form = document.querySelector('#generatorForm');
const videoUrl = document.querySelector('#videoUrl');
const videoFile = document.querySelector('#videoFile');
const fieldHelp = document.querySelector('#fieldHelp');
const uploadHelp = document.querySelector('#uploadHelp');
const uploadDropZone = document.querySelector('#uploadDropZone');
const uploadTitle = document.querySelector('#uploadTitle');
const uploadMeta = document.querySelector('#uploadMeta');
const linkInputPanel = document.querySelector('#linkInputPanel');
const uploadInputPanel = document.querySelector('#uploadInputPanel');
const linkModeButton = document.querySelector('#linkModeButton');
const uploadModeButton = document.querySelector('#uploadModeButton');
const agentProvider = document.querySelector('#agentProvider');
const modelProvider = document.querySelector('#modelProvider');
const modelName = document.querySelector('#modelName');
const modelHelp = document.querySelector('#modelHelp');
const submitButton = document.querySelector('#submitButton');
const submitLabel = document.querySelector('#submitLabel');
const pasteButton = document.querySelector('#pasteButton');
const shareButton = document.querySelector('#shareButton');
const jobTitle = document.querySelector('#jobTitle');
const jobMessage = document.querySelector('#jobMessage');
const statusBadge = document.querySelector('#statusBadge');
const progressBar = document.querySelector('#progressBar');
const jobLog = document.querySelector('#jobLog');
const logPanel = document.querySelector('#logPanel');
const resultPanel = document.querySelector('#resultPanel');
const resultName = document.querySelector('#resultName');
const documentPreview = document.querySelector('#documentPreview');
const downloadLink = document.querySelector('#downloadLink');
const pdfDownloadLink = document.querySelector('#pdfDownloadLink');
const copyResultButton = document.querySelector('#copyResultButton');
const agentLabel = document.querySelector('#agentLabel');
const steps = [...document.querySelectorAll('[data-step]')];

const accessKey = new URLSearchParams(location.search).get('key') || '';
let currentJobId = null;
let pollTimer = null;
let resultText = '';
let inputMode = 'link';
let selectedFile = null;
let maxUploadBytes = 500 * 1024 * 1024;

function apiHeaders(extra = {}) {
    return accessKey ? { ...extra, 'X-Planner-Key': accessKey } : extra;
}

function analysisOptions() {
    return {
        agent: agentProvider.value,
        provider: modelProvider.value,
        model: modelName.value.trim() || null,
    };
}

function analysisLabel(job) {
    const agents = { codex: 'Codex', claude: 'Claude Code', opencode: 'OpenCode', openclaw: 'OpenClaw' };
    const providers = { default: '默认模型', deepseek: 'DeepSeek', glm: '智谱 GLM', minimax: 'MiniMax', custom: '自定义模型' };
    const name = agents[job.agent] || job.agent;
    return job.model ? `${name} · ${providers[job.provider] || job.provider} / ${job.model}` : `${name} · 默认模型`;
}

function updateModelControls() {
    const externalProvider = modelProvider.value !== 'default';
    const compatibleRuntime = ['opencode', 'openclaw'].includes(agentProvider.value);
    if (externalProvider && !compatibleRuntime) {
        agentProvider.value = [...agentProvider.options].find(option => option.value === 'opencode' && !option.disabled)?.value
            || [...agentProvider.options].find(option => option.value === 'openclaw' && !option.disabled)?.value
            || agentProvider.value;
    }
    const defaults = {
        default: '留空使用运行器默认模型',
        deepseek: '默认 deepseek-chat，也可填写其它 DeepSeek 模型',
        glm: '默认 glm-4.6，也可填写其它 GLM 模型',
        minimax: '默认 MiniMax-M2，也可填写其它 MiniMax 模型',
        custom: '必填，例如 openrouter/deepseek/deepseek-chat',
    };
    modelName.placeholder = defaults[modelProvider.value];
    modelName.required = modelProvider.value === 'custom';
    modelHelp.textContent = externalProvider
        ? 'DeepSeek、GLM 和自定义模型通过 OpenCode / OpenClaw 运行；API Key 只从服务端环境变量读取。'
        : '策划案结构沿用现有工作流，内容判断由所选 Agent 和默认模型独立完成。';
}

function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setInputError(message) {
    videoUrl.classList.toggle('invalid', Boolean(message));
    fieldHelp.classList.toggle('error', Boolean(message));
    fieldHelp.textContent = message || '支持平台页面链接和 .mp4 / .mov / .webm 直链';
}

function setUploadError(message) {
    uploadDropZone.classList.toggle('invalid', Boolean(message));
    uploadHelp.classList.toggle('error', Boolean(message));
    uploadHelp.textContent = message || '视频只保存在运行服务的项目目录中';
}

function setMode(mode) {
    inputMode = mode;
    const uploading = mode === 'upload';
    linkInputPanel.hidden = uploading;
    uploadInputPanel.hidden = !uploading;
    linkModeButton.classList.toggle('active', !uploading);
    uploadModeButton.classList.toggle('active', uploading);
    linkModeButton.setAttribute('aria-pressed', String(!uploading));
    uploadModeButton.setAttribute('aria-pressed', String(uploading));
    submitLabel.textContent = uploading ? '上传并生成策划案' : '生成策划案';
    setInputError('');
    setUploadError('');
}

function chooseFile(file) {
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['mp4', 'mov', 'webm'].includes(extension)) {
        selectedFile = null;
        videoFile.value = '';
        setUploadError('仅支持 MP4、MOV 或 WEBM 视频文件。');
        return;
    }
    if (file.size > maxUploadBytes) {
        selectedFile = null;
        videoFile.value = '';
        setUploadError('视频不能超过 500 MB。');
        return;
    }
    if (file.size === 0) {
        selectedFile = null;
        videoFile.value = '';
        setUploadError('视频文件为空。');
        return;
    }
    selectedFile = file;
    uploadTitle.textContent = file.name;
    uploadMeta.textContent = `${formatBytes(file.size)} · 点击可重新选择`;
    setUploadError('');
}

function validUrl(value) {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function setSteps(activeCount) {
    steps.forEach((step, index) => step.classList.toggle('active', index < activeCount));
}

function setStatus(kind, title, message, progress) {
    statusBadge.className = `status-badge ${kind}`;
    statusBadge.textContent = ({ idle: '未开始', running: '处理中', failed: '失败', completed: '已完成' })[kind];
    jobTitle.textContent = title;
    jobMessage.textContent = message;
    progressBar.style.width = `${progress}%`;
}

async function request(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        headers: apiHeaders(options.headers || {}),
    });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
        throw new Error(payload.error || `请求失败（${response.status}）`);
    }
    return payload;
}

async function loadResult(job) {
    resultText = await request(`/api/jobs/${job.id}/document`);
    resultName.textContent = job.outputName || '策划案.md';
    documentPreview.textContent = resultText;
    downloadLink.href = `/api/jobs/${job.id}/download${accessKey ? `?key=${encodeURIComponent(accessKey)}` : ''}`;
    pdfDownloadLink.href = `/api/jobs/${job.id}/pdf${accessKey ? `?key=${encodeURIComponent(accessKey)}` : ''}`;
    pdfDownloadLink.hidden = !job.outputPdfName;
    resultPanel.hidden = false;
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function pollJob() {
    if (!currentJobId) return;
    try {
        const job = await request(`/api/jobs/${currentJobId}`);
        jobLog.textContent = job.log || '任务正在启动…';
        if (job.status === 'queued') {
            setStatus('running', '任务排队中', job.stage, 12);
            setSteps(1);
        } else if (job.status === 'running') {
            setStatus('running', '正在生成策划案', `${analysisLabel(job)} · ${job.stage}：${job.sourceLabel}`, 62);
            setSteps(2);
        } else if (job.status === 'completed') {
            clearInterval(pollTimer);
            pollTimer = null;
            submitButton.disabled = false;
            setStatus('completed', '策划案生成完成', job.outputName || '文件已保存到 docs/design/', 100);
            setSteps(3);
            await loadResult(job);
        } else if (job.status === 'failed') {
            clearInterval(pollTimer);
            pollTimer = null;
            submitButton.disabled = false;
            setStatus('failed', '生成失败', job.error || '请查看日志后重试。', 100);
            setSteps(1);
            logPanel.open = true;
        }
    } catch (error) {
        clearInterval(pollTimer);
        pollTimer = null;
        submitButton.disabled = false;
        setStatus('failed', '无法获取任务状态', error.message, 100);
    }
}

function startPolling(job) {
    currentJobId = job.id;
    if (pollTimer) clearInterval(pollTimer);
    pollJob();
    pollTimer = setInterval(pollJob, 1200);
}

function uploadAndCreateJob(file) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/jobs/upload');
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
        const options = analysisOptions();
        xhr.setRequestHeader('X-Planner-Agent', options.agent);
        xhr.setRequestHeader('X-Planner-Provider', options.provider);
        if (options.model) xhr.setRequestHeader('X-Planner-Model', options.model);
        if (accessKey) xhr.setRequestHeader('X-Planner-Key', accessKey);
        xhr.upload.addEventListener('progress', event => {
            if (!event.lengthComputable) return;
            const percent = Math.round((event.loaded / event.total) * 100);
            setStatus('running', '正在上传视频', `${file.name} · ${percent}%`, Math.max(5, percent * 0.4));
        });
        xhr.addEventListener('load', () => {
            let payload;
            try { payload = JSON.parse(xhr.responseText); } catch { payload = {}; }
            if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
            else reject(new Error(payload.error || `上传失败（${xhr.status}）`));
        });
        xhr.addEventListener('error', () => reject(new Error('上传连接中断，请重试。')));
        xhr.send(file);
    });
}

form.addEventListener('submit', async event => {
    event.preventDefault();
    const value = videoUrl.value.trim();
    if (inputMode === 'link' && !validUrl(value)) {
        setInputError('请输入有效的 HTTP 或 HTTPS 视频链接。');
        videoUrl.focus();
        return;
    }
    if (inputMode === 'upload' && !selectedFile) {
        setUploadError('请先选择一个视频文件。');
        return;
    }

    setInputError('');
    setUploadError('');
    resultPanel.hidden = true;
    submitButton.disabled = true;
    const sourceLabel = inputMode === 'upload' ? selectedFile.name : value;
    setStatus('running', inputMode === 'upload' ? '准备上传视频' : '正在创建任务', sourceLabel, 6);
    setSteps(1);
    jobLog.textContent = inputMode === 'upload' ? '正在上传视频文件…' : '正在提交链接…';
    try {
        const job = inputMode === 'upload'
            ? await uploadAndCreateJob(selectedFile)
            : await request('/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: value, ...analysisOptions() }),
            });
        startPolling(job);
    } catch (error) {
        submitButton.disabled = false;
        setStatus('failed', '提交失败', error.message, 100);
        setSteps(0);
    }
});

videoUrl.addEventListener('input', () => setInputError(''));
videoFile.addEventListener('change', () => chooseFile(videoFile.files?.[0]));
agentProvider.addEventListener('change', updateModelControls);
modelProvider.addEventListener('change', updateModelControls);
linkModeButton.addEventListener('click', () => setMode('link'));
uploadModeButton.addEventListener('click', () => setMode('upload'));

for (const eventName of ['dragenter', 'dragover']) {
    uploadDropZone.addEventListener(eventName, event => {
        event.preventDefault();
        uploadDropZone.classList.add('dragging');
    });
}
for (const eventName of ['dragleave', 'drop']) {
    uploadDropZone.addEventListener(eventName, event => {
        event.preventDefault();
        uploadDropZone.classList.remove('dragging');
    });
}
uploadDropZone.addEventListener('drop', event => chooseFile(event.dataTransfer?.files?.[0]));

pasteButton.addEventListener('click', async () => {
    try {
        videoUrl.value = await navigator.clipboard.readText();
        setInputError('');
        videoUrl.focus();
    } catch {
        setInputError('浏览器未允许读取剪贴板，请手动粘贴。');
    }
});

shareButton.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(location.href);
        shareButton.textContent = '已复制';
        setTimeout(() => { shareButton.textContent = '复制分享链接'; }, 1600);
    } catch {
        shareButton.textContent = '请复制地址栏链接';
    }
});

copyResultButton.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(resultText);
        copyResultButton.textContent = '已复制';
        setTimeout(() => { copyResultButton.textContent = '复制全文'; }, 1600);
    } catch {
        copyResultButton.textContent = '复制失败';
    }
});

request('/api/health')
    .then(health => {
        maxUploadBytes = health.maxUploadBytes || maxUploadBytes;
        for (const agent of health.agents || []) {
            const option = [...agentProvider.options].find(item => item.value === agent.id);
            if (!option) continue;
            option.disabled = !agent.available;
            option.textContent = `${agent.label}${agent.available ? '' : '（本机未安装）'}`;
        }
        agentProvider.value = health.defaultAgent || 'codex';
        if (agentProvider.selectedOptions[0]?.disabled) {
            agentProvider.value = [...agentProvider.options].find(option => !option.disabled)?.value || 'codex';
        }
        const availableCount = (health.agents || []).filter(agent => agent.available).length;
        agentLabel.textContent = `${availableCount} 个 Agent 运行器可用 · ${health.dryRun ? '演示模式' : '实时生成'}`;
        updateModelControls();
    })
    .catch(error => {
        agentLabel.textContent = error.message;
        setStatus('failed', '服务未连接', '请确认网页生成服务正在运行。', 100);
    });

// ======================
// Data Model & State
// ======================
let treeState = {
    version: 3.2,
    rootId: null,
    nodes: {},
    edges: [],
    maxDepth: 3,
    viewport: { x: 0, y: 0, scale: 1 },
    selectedNodeId: null,
    history: [],
    createdAt: Date.now()
};

let isDragging = false;
let dragStart = { x: 0, y: 0 };
let viewportStart = { ...treeState.viewport };

// ======================
// Color Conversion
// ======================
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(r, g, b) {
    const toHex = (c) => {
        const hex = Math.round(c).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
        const k = (n + h * 12) % 12;
        return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };
    return {
        r: Math.round(f(0) * 255),
        g: Math.round(f(8) * 255),
        b: Math.round(f(4) * 255)
    };
}

// ======================
// Color Generation Rules
// ======================
function deriveAnalogous(baseNode, delta = 30) {
    const hsl = baseNode.hsl;
    const results = [];
    for (let offset of [-delta, delta]) {
        const newH = (hsl.h + offset + 360) % 360;
        const newRgb = hslToRgb(newH, hsl.s, hsl.l);
        const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
        results.push(createColorNode(newHex, baseNode.id, 'analogous', { delta: offset }));
    }
    return results;
}

function deriveComplementary(baseNode) {
    const hsl = baseNode.hsl;
    const newH = (hsl.h + 180) % 360;
    const newRgb = hslToRgb(newH, hsl.s, hsl.l);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    return [createColorNode(newHex, baseNode.id, 'complementary', {})];
}

function deriveSplitComplementary(baseNode, delta = 30) {
    const hsl = baseNode.hsl;
    const results = [];
    for (let offset of [180 - delta, 180 + delta]) {
        const newH = (hsl.h + offset + 360) % 360;
        const newRgb = hslToRgb(newH, hsl.s, hsl.l);
        const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
        results.push(createColorNode(newHex, baseNode.id, 'split', { offset }));
    }
    return results;
}

function deriveTriad(baseNode) {
    const hsl = baseNode.hsl;
    const results = [];
    for (let offset of [120, 240]) {
        const newH = (hsl.h + offset) % 360;
        const newRgb = hslToRgb(newH, hsl.s, hsl.l);
        const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
        results.push(createColorNode(newHex, baseNode.id, 'triad', { offset }));
    }
    return results;
}

function deriveTetrad(baseNode) {
    const hsl = baseNode.hsl;
    const results = [];
    for (let offset of [90, 180, 270]) {
        const newH = (hsl.h + offset) % 360;
        const newRgb = hslToRgb(newH, hsl.s, hsl.l);
        const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
        results.push(createColorNode(newHex, baseNode.id, 'tetrad', { offset }));
    }
    return results;
}

function deriveTint(baseNode, step = 0.15) {
    const hsl = baseNode.hsl;
    const results = [];
    for (let i = 1; i <= 3; i++) {
        const newL = Math.min(95, hsl.l + (step * 100 * i));
        const newRgb = hslToRgb(hsl.h, Math.max(10, hsl.s - 5 * i), newL);
        const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
        results.push(createColorNode(newHex, baseNode.id, 'tint', { step: i }));
    }
    return results;
}

function deriveShade(baseNode, step = 0.15) {
    const hsl = baseNode.hsl;
    const results = [];
    for (let i = 1; i <= 3; i++) {
        const newL = Math.max(5, hsl.l - (step * 100 * i));
        const newRgb = hslToRgb(hsl.h, Math.min(100, hsl.s + 3 * i), newL);
        const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
        results.push(createColorNode(newHex, baseNode.id, 'shade', { step: i }));
    }
    return results;
}

function deriveTone(baseNode, step = 0.2) {
    const hsl = baseNode.hsl;
    const results = [];
    for (let i = 1; i <= 3; i++) {
        const newS = Math.max(5, hsl.s - (step * 100 * i));
        const newRgb = hslToRgb(hsl.h, newS, hsl.l);
        const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
        results.push(createColorNode(newHex, baseNode.id, 'tone', { step: i }));
    }
    return results;
}

// ======================
// Node Management
// ======================
function createColorNode(hex, parentId = null, rule = 'root', params = {}) {
    const id = 'n' + Date.now() + Math.random().toString(36).substr(2, 9);
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const parentNode = parentId ? treeState.nodes[parentId] : null;
    const depth = parentNode ? parentNode.depth + 1 : 0;

    return {
        id,
        parentId,
        hex: hex.toUpperCase(),
        rgb,
        hsl,
        derivation: { rule, params },
        state: 'pending',
        depth,
        createdAt: Date.now()
    };
}
// ======================
// History & Stats
// ======================
function addNode(node) {
    treeState.nodes[node.id] = node;
    if (node.parentId) {
        treeState.edges.push({ from: node.parentId, to: node.id });
    }
    addToHistory(node.hex, node.derivation.rule);
    updateStats();
}

function addToHistory(hex, rule) {
    const historyItem = {
        hex: hex.toUpperCase(),
        rule,
        timestamp: Date.now()
    };
    treeState.history.unshift(historyItem);
    if (treeState.history.length > 20) {
        treeState.history = treeState.history.slice(0, 20);
    }
    updateHistoryUI();
    saveToLocalStorage();
}

function updateHistoryUI() {
    const historyContainer = document.getElementById('colorHistory');
    if (!historyContainer) return;

    if (treeState.history.length === 0) {
        historyContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">履歴がありません</div>';
        return;
    }

    historyContainer.innerHTML = treeState.history.slice(0, 10).map(item => `
        <div class="history-item" onclick="applyHistoryColor('${item.hex}')">
            <div class="history-color" style="background-color: ${item.hex}"></div>
            <div class="history-info">
                <div class="history-hex">${item.hex}</div>
                <div class="history-time">${formatTime(item.timestamp)} - ${item.rule}</div>
            </div>
        </div>
    `).join('');

    // クリアボタン（HTMLに <button class="clear-history-btn" id="clearHistoryBtn"> を置いてない場合は動的に付与）
    if (!document.getElementById('clearHistoryBtn')) {
        const btn = document.createElement('button');
        btn.id = 'clearHistoryBtn';
        btn.className = 'clear-history-btn';
        btn.textContent = '履歴をクリア';
        btn.addEventListener('click', clearHistory);
        historyContainer.parentElement.appendChild(btn);
    }
}

function clearHistory() {
    treeState.history = [];
    updateHistoryUI();
    saveToLocalStorage();
    showNotification('履歴をクリアしました', 'info');
}

function applyHistoryColor(hex) {
    const hexInput = document.getElementById('hexInput');
    const colorPicker = document.getElementById('colorPicker');
    if (hexInput) hexInput.value = hex;
    if (colorPicker) colorPicker.value = hex;
    setRootColor();
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function updateStats() {
    const totalNodes = Object.keys(treeState.nodes).length;
    const adoptedNodes = Object.values(treeState.nodes).filter(n => n.state === 'adopted').length;
    const totalEl = document.getElementById('totalNodes');
    const adoptedEl = document.getElementById('adoptedNodes');
    if (totalEl) totalEl.textContent = totalNodes;
    if (adoptedEl) adoptedEl.textContent = adoptedNodes;
}

// ======================
// Root & Branching UI
// ======================
function setRootColor() {
    const hexInput = document.getElementById('hexInput');
    if (!hexInput) return;
    const hex = hexInput.value;

    if (!/^#?[0-9A-F]{6}$/i.test(hex)) {
        showNotification('無効なHEX形式です', 'error');
        return;
    }

    const normalizedHex = hex.startsWith('#') ? hex : '#' + hex;

    treeState.nodes = {};
    treeState.edges = [];
    treeState.selectedNodeId = null;

    const rootNode = createColorNode(normalizedHex);
    rootNode.state = 'adopted';
    addNode(rootNode);
    treeState.rootId = rootNode.id;

    renderTree();
    selectNode(rootNode.id);
    showNotification('起点色に設定しました', 'success');
}

function generateBranch(type) {
    // 押下フィードバック（inline onclickでも document.activeElement で拾える）
    const pressed = document.activeElement;
    if (pressed && pressed.classList.contains('btn')) {
        pressed.classList.add('btn-pressed');
        setTimeout(() => pressed.classList.remove('btn-pressed'), 180);
    }

    const selectedId = treeState.selectedNodeId;
    if (!selectedId) {
        showNotification('色のノードを選択してから分岐を生成してください', 'warning');
        return;
    }

    const baseNode = treeState.nodes[selectedId];
    if (baseNode.depth >= treeState.maxDepth) {
        showNotification(`最大深度${treeState.maxDepth}に達しています`, 'warning');
        return;
    }

    let newNodes = [];
    switch (type) {
        case 'analogous': newNodes = deriveAnalogous(baseNode); break;
        case 'complementary': newNodes = deriveComplementary(baseNode); break;
        case 'split': newNodes = deriveSplitComplementary(baseNode); break;
        case 'triad': newNodes = deriveTriad(baseNode); break;
        case 'tetrad': newNodes = deriveTetrad(baseNode); break;
        case 'tint': newNodes = deriveTint(baseNode); break;
        case 'shade': newNodes = deriveShade(baseNode); break;
        case 'tone': newNodes = deriveTone(baseNode); break;
        default: return;
    }

    newNodes.forEach(addNode);
    renderTree();

    const typeNames = {
        analogous: '近似色',
        complementary: '補色',
        split: '分割補色',
        triad: 'トライアド',
        tetrad: 'テトラード',
        tint: '明色',
        shade: '暗色',
        tone: '純色'
    };
    showNotification(`${baseNode.hex}から${typeNames[type]}を生成しました`, 'success');
}

// ======================
// Selection State
// ======================
function setNodeState(state) {
    if (!treeState.selectedNodeId) return;
    treeState.nodes[treeState.selectedNodeId].state = state;
    renderTree();
    updateSelectedNodeInfo();
    updateStats();
    saveToLocalStorage();

    const stateNames = { adopted: '採用', pending: '保留', rejected: '破棄' };
    showNotification(`色を${stateNames[state]}しました`, 'info');
}

function selectNode(nodeId) {
    treeState.selectedNodeId = nodeId;

    document.querySelectorAll('.color-node').forEach(node => {
        node.classList.remove('selected');
    });
    const selectedElement = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (selectedElement) {
        selectedElement.classList.add('selected');
    }
    updateSelectedNodeInfo();
}

function updateSelectedNodeInfo() {
    const nodeId = treeState.selectedNodeId;
    const currentSelectionArea = document.getElementById('currentSelectionArea');
    const selectionHint = document.getElementById('selectionHint');
    const branchButtons = document.querySelectorAll('.btn-group .btn');

    if (!nodeId || !treeState.nodes[nodeId]) {
        if (currentSelectionArea) currentSelectionArea.classList.remove('show');
        if (selectionHint) selectionHint.style.display = 'block';
        branchButtons.forEach(btn => btn.disabled = true);
        return;
    }

    if (currentSelectionArea) currentSelectionArea.classList.add('show');
    if (selectionHint) selectionHint.style.display = 'none';
    branchButtons.forEach(btn => btn.disabled = false);

    const node = treeState.nodes[nodeId];
    const selDisp = document.getElementById('selectedNodeDisplay');
    const selHex = document.getElementById('selectedNodeHex');
    if (selDisp) selDisp.textContent = node.derivation.rule;
    if (selHex) selHex.textContent = node.hex;

    const ph = document.getElementById('popup-hex');
    const pr = document.getElementById('popup-rgb');
    const ps = document.getElementById('popup-hsl');
    const pv = document.getElementById('popup-css-var');

    if (ph) ph.textContent = node.hex;
    if (pr) pr.textContent = `rgb(${node.rgb.r}, ${node.rgb.g}, ${node.rgb.b})`;
    if (ps) ps.textContent = `hsl(${node.hsl.h}, ${node.hsl.s}%, ${node.hsl.l}%)`;
    if (pv) pv.textContent = `--color-${node.derivation.rule}: ${node.hex}`;

    document.querySelectorAll('.state-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.state-btn.${node.state}`);
    if (activeBtn) activeBtn.classList.add('active');
}

// ======================
// Layout & Rendering
// ======================
function renderTree() {
    const svg = document.getElementById('treeSvg');
    if (!svg) return;

    // クリア
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const positions = calculateNodePositions();

    // ---- SVGのサイズを内容に合わせて可変 ----
    const coords = Object.values(positions);
    if (coords.length > 0) {
        const pad = 200;
        const maxX = Math.max(...coords.map(p => p.x)) + pad;
        const minX = Math.min(...coords.map(p => p.x)) - pad;
        const maxY = Math.max(...coords.map(p => p.y)) + pad;
        const minY = Math.min(...coords.map(p => p.y)) - pad;

        svg.setAttribute('width', maxX - minX);
        svg.setAttribute('height', maxY - minY);
        svg.setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
    }

    // ---- エッジ ----
    treeState.edges.forEach(edge => {
        const fromPos = positions[edge.from];
        const toPos   = positions[edge.to];
        if (!fromPos || !toPos) return;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'connection-line');
        line.setAttribute('x1', fromPos.x);
        line.setAttribute('y1', fromPos.y);
        line.setAttribute('x2', toPos.x);
        line.setAttribute('y2', toPos.y);
        svg.appendChild(line);
    });

    // ---- ノード ----
    Object.values(treeState.nodes).forEach(node => {
        const pos = positions[node.id];
        if (!pos) return;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', `color-node ${node.state}`);
        g.setAttribute('data-node-id', node.id);
        g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);

        // 選択時グロー
        if (treeState.selectedNodeId === node.id) {
            const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            glow.setAttribute('r', node.depth === 0 ? 38 : 33);
            glow.setAttribute('fill', 'none');
            glow.setAttribute('stroke', 'var(--accent-color)');
            glow.setAttribute('stroke-width', '3');
            glow.setAttribute('opacity', '0.6');
            g.appendChild(glow);
        }

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('r', node.depth === 0 ? 32 : 28);
        circle.setAttribute('fill', node.hex);
        circle.setAttribute('class', `node-circle ${node.state}`);
        g.appendChild(circle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('class', 'node-text');
        text.setAttribute('y', node.depth === 0 ? 46 : 42);
        text.setAttribute('font-size', '11');
        text.setAttribute('font-weight', 'bold');
        text.textContent = node.hex;
        g.appendChild(text);

        if (node.derivation.rule !== 'root') {
            const ruleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            ruleText.setAttribute('class', 'node-text');
            ruleText.setAttribute('y', node.depth === 0 ? 60 : 56);
            ruleText.setAttribute('font-size', '9');
            ruleText.setAttribute('opacity', '0.8');
            ruleText.textContent = node.derivation.rule;
            g.appendChild(ruleText);
        }

        g.addEventListener('click', (e) => {
            e.stopPropagation();
            selectNode(node.id);
        });

        g.addEventListener('touchend', (e) => {
            e.stopPropagation();
            e.preventDefault();
            selectNode(node.id);
        });

        svg.appendChild(g);
    });

    updateViewport(); // 現在のズーム状態を適用
}

function calculateNodePositions() {
    const positions = {};
    if (!treeState.rootId) return positions;

    const H = 200;  // 横間隔
    const V = 160;  // 縦間隔

    positions[treeState.rootId] = { x: 0, y: 0 };

    function dfs(parentId, px, py) {
        const children = Object.values(treeState.nodes).filter(n => n.parentId === parentId);
        const n = children.length;
        if (n === 0) return;

        const childY = py + V;
        const totalW = (n - 1) * H;
        const startX = px - totalW / 2;

        children.forEach((node, i) => {
            const cx = startX + i * H;
            positions[node.id] = { x: cx, y: childY };
            dfs(node.id, cx, childY);
        });
    }

    dfs(treeState.rootId, 0, 0);
    return positions;
}
// ======================
// Viewport & Zoom Control
// ======================
function centerView() {
    treeState.viewport.x = 0;
    treeState.viewport.y = 0;
    treeState.viewport.scale = 1;
    updateViewport();
}

function updateViewport() {
    const svg = document.getElementById('treeSvg');
    if (!svg) return;
    svg.style.transform = `translate(${treeState.viewport.x}px, ${treeState.viewport.y}px) scale(${treeState.viewport.scale})`;

    const zoomSlider = document.getElementById('zoomSlider');
    if (zoomSlider) {
        zoomSlider.value = treeState.viewport.scale;
    }
}

function zoomIn() {
    treeState.viewport.scale = Math.min(treeState.viewport.scale + 0.1, 3);
    updateViewport();
}

function zoomOut() {
    treeState.viewport.scale = Math.max(treeState.viewport.scale - 0.1, 0.5);
    updateViewport();
}

function setZoom(value) {
    treeState.viewport.scale = Math.min(Math.max(parseFloat(value), 0.5), 3);
    updateViewport();
}

// ======================
// Data Management
// ======================
function clearTree() {
    if (Object.keys(treeState.nodes).length === 0) {
        showNotification('クリアする内容がありません', 'info');
        return;
    }
    if (confirm('全ての色データを削除しますか？')) {
        treeState.nodes = {};
        treeState.edges = [];
        treeState.rootId = null;
        treeState.selectedNodeId = null;
        renderTree();
        updateSelectedNodeInfo();
        updateStats();
        saveToLocalStorage();
        showNotification('全てのデータをクリアしました', 'success');
    }
}

function saveToJSON() {
    const dataStr = JSON.stringify(treeState, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `conefla-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    showNotification('JSONファイルを保存しました', 'success');
}

function loadFromJSON() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.click();
}

function handleFileLoad(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            treeState = { ...treeState, ...data };
            if (!treeState.history) treeState.history = [];
            renderTree();
            updateSelectedNodeInfo();
            updateHistoryUI();
            updateStats();
            showNotification('JSONファイルを読み込みました', 'success');
        } catch (error) {
            console.error(error);
            showNotification('ファイルの読み込みに失敗しました', 'error');
        }
    };
    reader.readAsText(file);
}

// ======================
// Export as Image (Card Style)
// ======================
function exportPalette() {
    if (treeState.history.length === 0) {
        showNotification('履歴に色がありません', 'warning');
        return;
    }
    generatePaletteImage(treeState.history, 'conefla-history');
}

function generatePaletteImage(nodes, filename) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const cardWidth = 240;
    const cardHeight = 120;
    const padding = 20;
    const cols = 2;
    const rows = Math.ceil(nodes.length / cols);

    canvas.width = cols * (cardWidth + padding) + padding;
    canvas.height = rows * (cardHeight + padding) + padding + 60;

    // background
    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // title
    ctx.fillStyle = '#4ecdc4';
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('コネフラ - 探索履歴パレット', canvas.width / 2, 40);

    nodes.forEach((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = padding + col * (cardWidth + padding);
        const y = 60 + padding + row * (cardHeight + padding);

        // card bg
        ctx.fillStyle = '#1f1f1f';
        ctx.fillRect(x, y, cardWidth, cardHeight);
        ctx.strokeStyle = '#333';
        ctx.strokeRect(x, y, cardWidth, cardHeight);

        // color rect
        ctx.fillStyle = item.hex;
        ctx.fillRect(x + 10, y + 10, cardWidth - 20, 50);

        // labels
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(item.hex, x + 12, y + 80);

        ctx.font = '12px Inter, sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.fillText(item.rule, x + 12, y + 100);

        ctx.fillStyle = '#888';
        ctx.font = '11px Inter, sans-serif';
        ctx.fillText(formatTime(item.timestamp), x + 120, y + 100);
    });

    canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showNotification('パレット画像を保存しました', 'success');
    }, 'image/png');
}

// ======================
// Clipboard
// ======================
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('クリップボードにコピーしました', 'success');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showNotification('クリップボードにコピーしました', 'success');
    });
}

// ======================
// Notification
// ======================
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// ======================
// Local Storage
// ======================
function saveToLocalStorage() {
    try {
        localStorage.setItem('conefla-state', JSON.stringify(treeState));
    } catch (err) {
        console.warn('Save failed:', err);
    }
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('conefla-state');
        if (saved) {
            const data = JSON.parse(saved);
            if (data.version >= 2) {
                treeState = { ...treeState, ...data };
                if (!treeState.history) treeState.history = [];
                updateHistoryUI();
                updateStats();
                if (Object.keys(treeState.nodes).length > 0) {
                    renderTree();
                    updateSelectedNodeInfo();
                }
            }
        }
    } catch (err) {
        console.warn('Load failed:', err);
    }
}

// ======================
// Initialization
// ======================
function setupEventListeners() {
    const colorPicker = document.getElementById('colorPicker');
    const hexInput = document.getElementById('hexInput');
    const maxDepth = document.getElementById('maxDepth');
    const zoomSlider = document.getElementById('zoomSlider');

    if (colorPicker && hexInput) {
        colorPicker.addEventListener('change', e => {
            hexInput.value = e.target.value.toUpperCase();
        });
        hexInput.addEventListener('input', e => {
            let val = e.target.value.toUpperCase();
            if (val.length === 6 && !val.startsWith('#')) val = '#' + val;
            if (/^#[0-9A-F]{6}$/.test(val)) colorPicker.value = val;
        });
    }

    if (maxDepth) {
        maxDepth.addEventListener('input', e => {
            treeState.maxDepth = parseInt(e.target.value);
            const disp = document.getElementById('maxDepthValue');
            if (disp) disp.textContent = e.target.value;
            saveToLocalStorage();
        });
    }

    if (zoomSlider) {
        zoomSlider.addEventListener('input', e => setZoom(e.target.value));
    }
}

function initialize() {
    try {
        setupEventListeners();
        loadFromLocalStorage();

        const defaultColor = '#4ECDC4';
        const hexInput = document.getElementById('hexInput');
        const colorPicker = document.getElementById('colorPicker');
        if (hexInput) hexInput.value = defaultColor;
        if (colorPicker) colorPicker.value = defaultColor;

        if (Object.keys(treeState.nodes).length === 0) {
            setRootColor();
        } else {
            renderTree();
            updateSelectedNodeInfo();
        }
        centerView();
        showNotification('コネフラへようこそ！', 'info');
    } catch (err) {
        console.error('Init error:', err);
    }
}

document.addEventListener('DOMContentLoaded', initialize);
setInterval(saveToLocalStorage, 30000);
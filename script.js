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
// Color Derivation Rules
// ======================
function deriveAnalogous(baseNode, delta = 30) {
    const hsl = rgbToHsl(baseNode.rgb.r, baseNode.rgb.g, baseNode.rgb.b);
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
    const hsl = rgbToHsl(baseNode.rgb.r, baseNode.rgb.g, baseNode.rgb.b);
    const newH = (hsl.h + 180) % 360;
    const newRgb = hslToRgb(newH, hsl.s, hsl.l);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    return [createColorNode(newHex, baseNode.id, 'complementary', {})];
}

function deriveSplitComplementary(baseNode, delta = 30) {
    const hsl = rgbToHsl(baseNode.rgb.r, baseNode.rgb.g, baseNode.rgb.b);
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
    const hsl = rgbToHsl(baseNode.rgb.r, baseNode.rgb.g, baseNode.rgb.b);
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
    const hsl = rgbToHsl(baseNode.rgb.r, baseNode.rgb.g, baseNode.rgb.b);
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
    const hsl = rgbToHsl(baseNode.rgb.r, baseNode.rgb.g, baseNode.rgb.b);
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
    const hsl = rgbToHsl(baseNode.rgb.r, baseNode.rgb.g, baseNode.rgb.b);
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
    const hsl = rgbToHsl(baseNode.rgb.r, baseNode.rgb.g, baseNode.rgb.b);
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
// Node / History Handling
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
}

function applyHistoryColor(hex) {
    document.getElementById('hexInput').value = hex;
    document.getElementById('colorPicker').value = hex;
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
    document.getElementById('totalNodes').textContent = totalNodes;
    document.getElementById('adoptedNodes').textContent = adoptedNodes;
}

// ======================
// Root Color & Branches
// ======================
function setRootColor() {
    const hex = document.getElementById('hexInput').value;
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
    let selectedId = treeState.selectedNodeId;
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
// Node State / Selection
// ======================
function setNodeState(state) {
    if (!treeState.selectedNodeId) return;
    treeState.nodes[treeState.selectedNodeId].state = state;
    renderTree();
    updateSelectedNodeInfo();
    updateStats();
    saveToLocalStorage();

    const stateNames = {
        adopted: '採用',
        pending: '保留',
        rejected: '破棄'
    };
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
        currentSelectionArea.classList.remove('show');
        selectionHint.style.display = 'block';
        branchButtons.forEach(btn => btn.disabled = true);
        return;
    }

    currentSelectionArea.classList.add('show');
    selectionHint.style.display = 'none';
    branchButtons.forEach(btn => btn.disabled = false);

    const node = treeState.nodes[nodeId];
    document.getElementById('selectedNodeDisplay').textContent = node.derivation.rule;
    document.getElementById('selectedNodeHex').textContent = node.hex;

    document.getElementById('popup-hex').textContent = node.hex;
    document.getElementById('popup-rgb').textContent = `rgb(${node.rgb.r}, ${node.rgb.g}, ${node.rgb.b})`;
    document.getElementById('popup-hsl').textContent = `hsl(${node.hsl.h}, ${node.hsl.s}%, ${node.hsl.l}%)`;
    document.getElementById('popup-css-var').textContent = `--color-${node.derivation.rule}: ${node.hex}`;

    document.querySelectorAll('.state-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.state-btn.${node.state}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}
// ======================
// Tree Rendering
// ======================
function renderTree() {
    const svg = document.getElementById('treeSvg');
    if (!svg) return;

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const positions = calculateNodePositions();

    // ==== SVG サイズ自動調整 ====
    const coords = Object.values(positions);
    if (coords.length > 0) {
        const maxX = Math.max(...coords.map(p => p.x)) + 200;
        const minX = Math.min(...coords.map(p => p.x)) - 200;
        const maxY = Math.max(...coords.map(p => p.y)) + 200;
        const minY = Math.min(...coords.map(p => p.y)) - 200;

        svg.setAttribute("width", maxX - minX);
        svg.setAttribute("height", maxY - minY);
        svg.setAttribute("viewBox", `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
    }

    // ==== エッジ描画 ====
    treeState.edges.forEach(edge => {
        const fromPos = positions[edge.from];
        const toPos = positions[edge.to];
        if (fromPos && toPos) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('class', 'connection-line');
            line.setAttribute('x1', fromPos.x);
            line.setAttribute('y1', fromPos.y);
            line.setAttribute('x2', toPos.x);
            line.setAttribute('y2', toPos.y);
            svg.appendChild(line);
        }
    });

    // ==== ノード描画 ====
    Object.values(treeState.nodes).forEach(node => {
        const pos = positions[node.id];
        if (!pos) return;

        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', `color-node ${node.state}`);
        group.setAttribute('data-node-id', node.id);
        group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);

        if (treeState.selectedNodeId === node.id) {
            const glowCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            glowCircle.setAttribute('r', node.depth === 0 ? 38 : 33);
            glowCircle.setAttribute('fill', 'none');
            glowCircle.setAttribute('stroke', 'var(--accent-color)');
            glowCircle.setAttribute('stroke-width', '3');
            glowCircle.setAttribute('opacity', '0.6');
            group.appendChild(glowCircle);
        }

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('r', node.depth === 0 ? 32 : 28);
        circle.setAttribute('fill', node.hex);
        circle.setAttribute('class', `node-circle ${node.state}`);
        group.appendChild(circle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('class', 'node-text');
        text.setAttribute('y', node.depth === 0 ? 46 : 42);
        text.setAttribute('font-size', '11');
        text.setAttribute('font-weight', 'bold');
        text.textContent = node.hex;
        group.appendChild(text);

        if (node.derivation.rule !== 'root') {
            const ruleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            ruleText.setAttribute('class', 'node-text');
            ruleText.setAttribute('y', node.depth === 0 ? 60 : 56);
            ruleText.setAttribute('font-size', '9');
            ruleText.setAttribute('opacity', '0.8');
            ruleText.textContent = node.derivation.rule;
            group.appendChild(ruleText);
        }

        group.addEventListener('click', (e) => {
            e.stopPropagation();
            selectNode(node.id);
        });

        group.addEventListener('touchend', (e) => {
            e.stopPropagation();
            e.preventDefault();
            selectNode(node.id);
        });

        svg.appendChild(group);
    });

    updateViewport();
}

function calculateNodePositions() {
    const positions = {};
    if (!treeState.rootId) return positions;

    const horizontalSpacing = 200;
    const verticalSpacing = 160;

    positions[treeState.rootId] = { x: 0, y: 0 };

    function positionChildren(parentId, parentX, parentY) {
        const children = Object.values(treeState.nodes).filter(node => node.parentId === parentId);
        const numChildren = children.length;
        if (numChildren === 0) return;

        const childY = parentY + verticalSpacing;
        const totalWidth = (numChildren - 1) * horizontalSpacing;
        const startX = parentX - totalWidth / 2;

        children.forEach((node, index) => {
            const childX = startX + index * horizontalSpacing;
            positions[node.id] = { x: childX, y: childY };
            positionChildren(node.id, childX, childY);
        });
    }

    positionChildren(treeState.rootId, 0, 0);
    return positions;
}

// ======================
// Viewport Handling
// ======================
function centerView() {
    treeState.viewport.x = 0;
    treeState.viewport.y = 0;
    treeState.viewport.scale = 1;
    updateViewport();
}

function fitToView() {
    if (Object.keys(treeState.nodes).length <= 1) {
        centerView();
        return;
    }
    const positions = calculateNodePositions();
    const coords = Object.values(positions);
    const minX = Math.min(...coords.map(p => p.x)) - 60;
    const maxX = Math.max(...coords.map(p => p.x)) + 60;
    const minY = Math.min(...coords.map(p => p.y)) - 60;
    const maxY = Math.max(...coords.map(p => p.y)) + 60;
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const scale = Math.min(window.innerWidth / contentWidth, window.innerHeight / contentHeight, 1.5);

    treeState.viewport.x = 0;
    treeState.viewport.y = 0;
    treeState.viewport.scale = scale;
    updateViewport();
}

function resetZoom() {
    treeState.viewport.scale = 1;
    updateViewport();
}

function updateViewport() {
    const svg = document.getElementById('treeSvg');
    if (svg) {
        svg.style.transform = `translate(${treeState.viewport.x}px, ${treeState.viewport.y}px) scale(${treeState.viewport.scale})`;
    }
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
    link.download = `conectfla-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification('JSONファイルを保存しました', 'success');
}

function loadFromJSON() {
    document.getElementById('fileInput').click();
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
            centerView();
            showNotification('JSONファイルを読み込みました', 'success');
        } catch (error) {
            showNotification('ファイルの読み込みに失敗しました', 'error');
        }
    };
    reader.readAsText(file);
}

// ======================
// Clipboard & Notify
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

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 4000);
}

// ======================
// Local Storage
// ======================
function saveToLocalStorage() {
    try {
        localStorage.setItem('conectfla-state', JSON.stringify(treeState));
    } catch (error) {
        console.warn('Failed to save state:', error);
    }
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('conectfla-state');
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
    } catch (error) {
        console.warn('Failed to load state:', error);
    }
}

// ======================
// Event Listeners & Init
// ======================
function setupEventListeners() {
    const colorPicker = document.getElementById('colorPicker');
    const hexInput = document.getElementById('hexInput');
    const maxDepth = document.getElementById('maxDepth');

    if (colorPicker) {
        colorPicker.addEventListener('change', (e) => {
            const hex = e.target.value.toUpperCase();
            if (hexInput) hexInput.value = hex;
        });
    }

    if (hexInput) {
        hexInput.addEventListener('input', (e) => {
            let hex = e.target.value.toUpperCase();
            if (hex.length === 6 && !hex.startsWith('#')) {
                hex = '#' + hex;
            }
            if (/^#[0-9A-F]{6}$/i.test(hex) && colorPicker) {
                colorPicker.value = hex;
            }
        });
    }

    if (maxDepth) {
        maxDepth.addEventListener('input', (e) => {
            treeState.maxDepth = parseInt(e.target.value);
            const maxDepthValue = document.getElementById('maxDepthValue');
            if (maxDepthValue) maxDepthValue.textContent = e.target.value;
            saveToLocalStorage();
        });
    }
}

function initialize() {
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
        centerView();
    }

    showNotification('コネフラへようこそ！', 'info');
}

document.addEventListener('DOMContentLoaded', initialize);
setInterval(saveToLocalStorage, 30000);
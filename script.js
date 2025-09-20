// Data Model & History
let treeState = {
    version: 3,
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
let viewportStart = { x: 0, y: 0 };

// Color Conversion Functions
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

// Color Generation Functions with improved algorithms
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

// Node Management
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

function addNode(node) {
    treeState.nodes[node.id] = node;
    if (node.parentId) {
        treeState.edges.push({ from: node.parentId, to: node.id });
    }
    
    // Add to history
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
    
    // Keep only last 20 items
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

// UI Functions
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

    centerView();
    renderTree();
    selectNode(rootNode.id);
    showNotification('起点色を設定しました', 'success');
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
    
    // updateSelectedNodeInfo() を呼び出し、ポップアップを表示
    updateSelectedNodeInfo();
    showPopup();
}

function closePopup() {
    document.getElementById('node-popup').style.display = 'none';
    document.querySelectorAll('.color-node').forEach(node => {
        node.classList.remove('selected');
    });
    treeState.selectedNodeId = null;
}

function showPopup() {
    document.getElementById('node-popup').style.display = 'block';
}

function updateSelectedNodeInfo() {
    const nodeId = treeState.selectedNodeId;
    
    if (!nodeId || !treeState.nodes[nodeId]) {
        // ノードが選択されていない場合はポップアップを非表示に
        closePopup();
        return;
    }
    
    const node = treeState.nodes[nodeId];

    // ポップアップのDOM要素を更新
    document.getElementById('popup-color-preview').style.backgroundColor = node.hex;
    document.getElementById('popup-hex-code').textContent = node.hex;
    document.getElementById('popup-hex').textContent = node.hex;
    document.getElementById('popup-rgb').textContent = `rgb(${node.rgb.r}, ${node.rgb.g}, ${node.rgb.b})`;
    document.getElementById('popup-hsl').textContent = `hsl(${node.hsl.h}, ${node.hsl.s}%, ${node.hsl.l}%)`;
    document.getElementById('popup-css-var').textContent = `--color-${node.derivation.rule}: ${node.hex}`;
    document.getElementById('popup-rule').textContent = node.derivation.rule;
    document.getElementById('popup-depth').textContent = node.depth;
    document.getElementById('popup-time').textContent = formatTime(node.createdAt);
    
    // コピーボタンのデータ属性を更新
    document.querySelector('#popup-hex').parentElement.dataset.value = node.hex;
    document.querySelector('#popup-rgb').parentElement.dataset.value = `rgb(${node.rgb.r}, ${node.rgb.g}, ${node.rgb.b})`;
    document.querySelector('#popup-hsl').parentElement.dataset.value = `hsl(${node.hsl.h}, ${node.hsl.s}%, ${node.hsl.l}%)`;
    document.querySelector('#popup-css-var').parentElement.dataset.value = `--color-${node.derivation.rule}: ${node.hex}`;

    // 採用・保留・破棄ボタンの active 状態を更新
    document.querySelectorAll('.state-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.state-btn.${node.state}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // コントロールパネルの表示も更新
    const currentSelection = document.getElementById('currentSelection');
    const selectedNodeDisplay = document.getElementById('selectedNodeDisplay');
    const selectedNodeHex = document.getElementById('selectedNodeHex');
    const selectionHint = document.getElementById('selectionHint');
    const branchButtons = document.querySelectorAll('.btn-group .btn');
    
    currentSelection.style.display = 'flex';
    selectionHint.style.display = 'none';
    branchButtons.forEach(btn => btn.disabled = false);

    selectedNodeDisplay.textContent = node.derivation.rule;
    selectedNodeHex.textContent = node.hex;
}


function renderTree() {
    const svg = document.getElementById('treeSvg');
    const container = document.getElementById('canvasContainer');
    
    if (!svg || !container) return;
    
    svg.innerHTML = '';
    
    const positions = calculateNodePositions();
    
    // Draw edges first
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
    
    // Draw nodes
    Object.values(treeState.nodes).forEach(node => {
        const pos = positions[node.id];
        if (!pos) return;
        
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', `color-node ${node.state}`);
        group.setAttribute('data-node-id', node.id);
        group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
        
        // Outer glow for selected state
        if (treeState.selectedNodeId === node.id) {
            const glowCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            glowCircle.setAttribute('r', node.depth === 0 ? 38 : 33);
            glowCircle.setAttribute('fill', 'none');
            glowCircle.setAttribute('stroke', '#4ecdc4');
            glowCircle.setAttribute('stroke-width', '3');
            glowCircle.setAttribute('opacity', '0.6');
            group.appendChild(glowCircle);
        }
        
        // Main circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('r', node.depth === 0 ? 32 : 28);
        circle.setAttribute('fill', node.hex);
        circle.setAttribute('class', `node-circle ${node.state}`);
        group.appendChild(circle);
        
        // HEX label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('class', 'node-text');
        text.setAttribute('y', node.depth === 0 ? 46 : 42);
        text.setAttribute('font-size', '11');
        text.setAttribute('font-weight', 'bold');
        text.textContent = node.hex;
        group.appendChild(text);
        
        // Rule label
        if (node.derivation.rule !== 'root') {
            const ruleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            ruleText.setAttribute('class', 'node-text');
            ruleText.setAttribute('y', node.depth === 0 ? 60 : 56);
            ruleText.setAttribute('font-size', '9');
            ruleText.setAttribute('opacity', '0.8');
            ruleText.textContent = node.derivation.rule;
            group.appendChild(ruleText);
        }
        
        // Event listeners
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

    // Define layout parameters
    const horizontalSpacing = 200; // 水平方向のノード間隔
    const verticalSpacing = 160;   // 垂直方向のノード間隔 (レベル間の距離)

    // Group nodes by depth and parent
    const levelNodes = {};
    const parentChildrenCount = {};
    Object.values(treeState.nodes).forEach(node => {
        if (!levelNodes[node.depth]) levelNodes[node.depth] = [];
        levelNodes[node.depth].push(node);
        
        if (node.parentId) {
            if (!parentChildrenCount[node.parentId]) parentChildrenCount[node.parentId] = 0;
            parentChildrenCount[node.parentId]++;
        }
    });

    // Position the root node at the center
    positions[treeState.rootId] = { x: 0, y: 0 };
    
    // Recursively position children
    function positionChildren(parentId, parentX, parentY, totalSiblings, siblingIndex, level) {
        const children = Object.values(treeState.nodes).filter(node => node.parentId === parentId);
        const numChildren = children.length;
        
        // Children's vertical position is below the parent
        const childY = parentY + verticalSpacing;

        // Spread children horizontally
        children.forEach((node, index) => {
            // Calculate an offset based on the number of children
            const totalWidth = (numChildren - 1) * horizontalSpacing;
            const startX = parentX - totalWidth / 2;
            const childX = startX + index * horizontalSpacing;
            
            positions[node.id] = { x: childX, y: childY };
            
            // Recursively position grandchildren
            positionChildren(node.id, childX, childY, numChildren, index, level + 1);
        });
    }

    // Start positioning from the root
    positionChildren(treeState.rootId, 0, 0, 1, 0, 1);
    
    return positions;
}


// Canvas Controls
function centerView() {
    const container = document.getElementById('canvasContainer');
    const rect = container.getBoundingClientRect();
    treeState.viewport.x = rect.width / 2;
    treeState.viewport.y = rect.height / 2;
    treeState.viewport.scale = 1;
    updateViewport();
}

function fitToView() {
    if (Object.keys(treeState.nodes).length === 0) return;
    
    const container = document.getElementById('canvasContainer');
    const rect = container.getBoundingClientRect();
    const positions = calculateNodePositions();
    const coords = Object.values(positions);
    
    if (coords.length === 0) return;
    
    const minX = Math.min(...coords.map(p => p.x)) - 60;
    const maxX = Math.max(...coords.map(p => p.x)) + 60;
    const minY = Math.min(...coords.map(p => p.y)) - 60;
    const maxY = Math.max(...coords.map(p => p.y)) + 60;
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    const scaleX = rect.width / contentWidth;
    const scaleY = rect.height / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    treeState.viewport.x = rect.width / 2 - centerX * scale;
    treeState.viewport.y = rect.height / 2 - centerY * scale;
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

// Data Management
function clearTree() {
    if (Object.keys(treeState.nodes).length === 0) {
        showNotification('クリアする内容がありません', 'info');
        return;
    }
    
    if (confirm('全ての色データを削除しますか？この操作は元に戻せません。')) {
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
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const link = document.createElement('a');
    link.href = url;
    link.download = `conectfla-${timestamp}.json`;
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
            if (data.version < 2) {
                showNotification('古いバージョンのファイルです。正常に読み込まれない可能性があります。', 'warning');
            }
            
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
            console.error('File load error:', error);
        }
    };
    reader.readAsText(file);
}

function exportPalette() {
    const adoptedNodes = Object.values(treeState.nodes).filter(node => node.state === 'adopted');
    const allNodes = Object.values(treeState.nodes).sort((a,b) => a.depth - b.depth);
    const nodesToExport = adoptedNodes.length > 0 ? adoptedNodes : allNodes;

    if (nodesToExport.length === 0) {
        showNotification('エクスポートする色がありません', 'warning');
        return;
    }
    
    generatePaletteImage(nodesToExport, 'conectfla-palette');
}

function exportAdoptedColors() {
    const adoptedNodes = Object.values(treeState.nodes).filter(node => node.state === 'adopted');
    if (adoptedNodes.length === 0) {
        showNotification('採用された色がありません', 'warning');
        return;
    }
    generatePaletteImage(adoptedNodes, 'conectfla-adopted');
}

function exportCSS() {
    const adoptedNodes = Object.values(treeState.nodes).filter(node => node.state === 'adopted');
    if (adoptedNodes.length === 0) {
        showNotification('採用された色がありません', 'warning');
        return;
    }
    
    const cssVars = adoptedNodes.map(node => 
        `  --color-${node.derivation.rule}${node.id.slice(-3)}: ${node.hex};`
    ).join('\n');
    
    const cssContent = `:root {\n${cssVars}\n}`;
    
    const blob = new Blob([cssContent], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `conectfla-colors-${Date.now()}.css`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    showNotification('CSS変数ファイルを保存しました', 'success');
}

function generatePaletteImage(nodes, filename) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const cardWidth = 200;
    const cardHeight = 140;
    const padding = 24;
    const cols = Math.min(nodes.length, Math.ceil(Math.sqrt(nodes.length)));
    const rows = Math.ceil(nodes.length / cols);
    const canvasWidth = cols * cardWidth + (cols + 1) * padding;
    const canvasHeight = rows * cardHeight + (rows + 1) * padding + 100;
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, '#0a0a0a');
    gradient.addColorStop(1, '#1f1f1f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Title
    ctx.fillStyle = '#4ecdc4';
    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('コネフラ - カラーパレット', canvasWidth / 2, 60);
    
    // Color cards
    nodes.forEach((node, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = col * cardWidth + (col + 1) * padding;
        const y = row * cardHeight + (row + 1) * padding + 100;
        
        // Card background
        ctx.fillStyle = '#222';
        ctx.fillRect(x, y, cardWidth, cardHeight);
        
        // Color area
        ctx.fillStyle = node.hex;
        ctx.fillRect(x + 12, y + 12, cardWidth - 24, cardHeight - 60);
        
        // HEX label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(node.hex, x + cardWidth / 2, y + cardHeight - 30);
        
        // Rule label
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(node.derivation.rule, x + cardWidth / 2, y + cardHeight - 10);
    });
    
    canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showNotification('パレット画像を保存しました', 'success');
    }, 'image/png');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('クリップボードにコピーしました', 'success');
    }).catch(err => {
        // Fallback for older browsers
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

// Local Storage
function saveToLocalStorage() {
    try {
        localStorage.setItem('conectfla-state', JSON.stringify(treeState));
    } catch (error) {
        console.warn('Failed to save to localStorage:', error);
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
                    // selectNode()を呼び出すのではなく、ポップアップの状態を直接更新
                    if (treeState.selectedNodeId) {
                        updateSelectedNodeInfo();
                        showPopup();
                    }
                }
            }
        }
    } catch (error) {
        console.warn('Failed to load from localStorage:', error);
    }
}

// Canvas interaction
function setupCanvasInteraction() {
    const container = document.getElementById('canvasContainer');
    const svg = document.getElementById('treeSvg');
    
    // Mouse events
    container.addEventListener('mousedown', (e) => {
        if (e.target.closest('.color-node')) return;
        isDragging = true;
        dragStart = { x: e.clientX, y: e.clientY };
        viewportStart = { ...treeState.viewport };
        container.classList.add('dragging');
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        treeState.viewport.x = viewportStart.x + dx;
        treeState.viewport.y = viewportStart.y + dy;
        updateViewport();
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        container.classList.remove('dragging');
    });
    
    // Wheel zoom
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.1, Math.min(4, treeState.viewport.scale * delta));
        
        // Zoom toward mouse position
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const scaleDiff = newScale - treeState.viewport.scale;
        treeState.viewport.x -= (mouseX - treeState.viewport.x) * scaleDiff / treeState.viewport.scale;
        treeState.viewport.y -= (mouseY - treeState.viewport.y) * scaleDiff / treeState.viewport.scale;
        treeState.viewport.scale = newScale;
        
        updateViewport();
    });

    // Touch events
    let lastTouchDistance = 0;
    
    container.addEventListener('touchstart', (e) => {
        if (e.target.closest('.color-node')) return;
        
        if (e.touches.length === 1) {
            isDragging = true;
            dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            viewportStart = { ...treeState.viewport };
            container.classList.add('dragging');
        } else if (e.touches.length === 2) {
            isDragging = false;
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            lastTouchDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
        }
        
        e.preventDefault();
    });

    container.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && isDragging) {
            const dx = e.touches[0].clientX - dragStart.x;
            const dy = e.touches[0].clientY - dragStart.y;
            treeState.viewport.x = viewportStart.x + dx;
            treeState.viewport.y = viewportStart.y + dy;
            updateViewport();
        } else if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const distance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            if (lastTouchDistance > 0) {
                const scale = distance / lastTouchDistance;
                treeState.viewport.scale = Math.max(0.1, Math.min(4, treeState.viewport.scale * scale));
                updateViewport();
            }
            
            lastTouchDistance = distance;
        }
        
        e.preventDefault();
    });

    container.addEventListener('touchend', () => {
        isDragging = false;
        container.classList.remove('dragging');
        lastTouchDistance = 0;
    });
}

// Event listeners
document.getElementById('colorPicker').addEventListener('change', (e) => {
    const hex = e.target.value.toUpperCase();
    document.getElementById('hexInput').value = hex;
});

document.getElementById('hexInput').addEventListener('input', (e) => {
    let hex = e.target.value.toUpperCase();
    if (hex.length === 6 && !hex.startsWith('#')) {
        hex = '#' + hex;
    }
    if (/^#[0-9A-F]{6}$/i.test(hex)) {
        document.getElementById('colorPicker').value = hex;
    }
});

document.getElementById('maxDepth').addEventListener('input', (e) => {
    treeState.maxDepth = parseInt(e.target.value);
    document.getElementById('maxDepthValue').textContent = e.target.value;
    saveToLocalStorage();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 's':
                e.preventDefault();
                saveToJSON();
                break;
            case 'o':
                e.preventDefault();
                loadFromJSON();
                break;
        }
    }
    
    if (treeState.selectedNodeId) {
        switch (e.key) {
            case '1':
                setNodeState('adopted');
                break;
            case '2':
                setNodeState('pending');
                break;
            case '3':
                setNodeState('rejected');
                break;
        }
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupCanvasInteraction();
    loadFromLocalStorage();
    
    const defaultColor = '#4ECDC4';
    document.getElementById('hexInput').value = defaultColor;
    document.getElementById('colorPicker').value = defaultColor;
    
    if (Object.keys(treeState.nodes).length === 0) {
        setRootColor();
    }
    
    centerView();
    showNotification('コネフラへようこそ！', 'info');
});

// Auto-save
setInterval(saveToLocalStorage, 30000); // Save every 30 seconds

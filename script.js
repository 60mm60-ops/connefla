// =============================
// Data Model & 初期状態
// =============================
let treeState = {
  version: 4.0,
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

// =============================
// カラーモデル変換
// =============================
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
// =============================
// 分岐生成アルゴリズム
// =============================
function deriveAnalogous(baseNode, delta = 30) {
  const hsl = rgbToHsl(baseNode.rgb.r, baseNode.rgb.g, baseNode.rgb.b);
  const results = [];
  for (let offset of [-delta, delta]) {
    const newH = (hsl.h + offset + 360) % 360;
    const newRgb = hslToRgb(newH, hsl.s, hsl.l);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    results.push(createColorNode(newHex, baseNode.id, "analogous", { delta: offset }));
  }
  return results;
}

function deriveComplementary(baseNode) {
  const hsl = rgbToHsl(baseNode.rgb.r, baseNode.rgb.g, baseNode.rgb.b);
  const newH = (hsl.h + 180) % 360;
  const newRgb = hslToRgb(newH, hsl.s, hsl.l);
  const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
  return [createColorNode(newHex, baseNode.id, "complementary", {})];
}

function deriveSplitComplementary(baseNode, delta = 30) {
  const hsl = rgbToHsl(baseNode.rgb.r, baseNode.rgb.g, baseNode.rgb.b);
  return [180 - delta, 180 + delta].map(offset => {
    const newH = (hsl.h + offset + 360) % 360;
    const newRgb = hslToRgb(newH, hsl.s, hsl.l);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    return createColorNode(newHex, baseNode.id, "split", { offset });
  });
}

function deriveTriad(baseNode) {
  const hsl = rgbToHsl(baseNode.rgb.r, baseNode.rgb.g, baseNode.rgb.b);
  return [120, 240].map(offset => {
    const newH = (hsl.h + offset) % 360;
    const newRgb = hslToRgb(newH, hsl.s, hsl.l);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    return createColorNode(newHex, baseNode.id, "triad", { offset });
  });
}

function deriveTetrad(baseNode) {
  const hsl = rgbToHsl(baseNode.rgb.r, baseNode.rgb.g, baseNode.rgb.b);
  return [90, 180, 270].map(offset => {
    const newH = (hsl.h + offset) % 360;
    const newRgb = hslToRgb(newH, hsl.s, hsl.l);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    return createColorNode(newHex, baseNode.id, "tetrad", { offset });
  });
}

function deriveTint(baseNode, step = 0.15) {
  const hsl = rgbToHsl(baseNode.rgb.r, baseNode.rgb.g, baseNode.rgb.b);
  return Array.from({ length: 3 }, (_, i) => {
    const newL = Math.min(95, hsl.l + step * 100 * (i + 1));
    const newRgb = hslToRgb(hsl.h, Math.max(10, hsl.s - 5 * (i + 1)), newL);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    return createColorNode(newHex, baseNode.id, "tint", { step: i + 1 });
  });
}

function deriveShade(baseNode, step = 0.15) {
  const hsl = rgbToHsl(baseNode.rgb.r, baseNode.rgb.g, baseNode.rgb.b);
  return Array.from({ length: 3 }, (_, i) => {
    const newL = Math.max(5, hsl.l - step * 100 * (i + 1));
    const newRgb = hslToRgb(hsl.h, Math.min(100, hsl.s + 3 * (i + 1)), newL);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    return createColorNode(newHex, baseNode.id, "shade", { step: i + 1 });
  });
}

function deriveTone(baseNode, step = 0.2) {
  const hsl = rgbToHsl(baseNode.rgb.r, baseNode.rgb.g, baseNode.rgb.b);
  return Array.from({ length: 3 }, (_, i) => {
    const newS = Math.max(5, hsl.s - step * 100 * (i + 1));
    const newRgb = hslToRgb(hsl.h, newS, hsl.l);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    return createColorNode(newHex, baseNode.id, "tone", { step: i + 1 });
  });
}

// =============================
// ノード管理
// =============================
function createColorNode(hex, parentId = null, rule = "root", params = {}) {
  const id = "n" + Date.now() + Math.random().toString(36).substr(2, 9);
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
    state: "pending",
    depth,
    createdAt: Date.now()
  };
}

function addNode(node) {
  treeState.nodes[node.id] = node;
  if (node.parentId) {
    treeState.edges.push({ from: node.parentId, to: node.id });
  }
  addToHistory(node.hex, node.derivation.rule);
  updateStats();
}
// =============================
// 履歴・統計
// =============================
function addToHistory(hex, rule) {
  const historyItem = { hex: hex.toUpperCase(), rule, timestamp: Date.now() };
  treeState.history.unshift(historyItem);
  if (treeState.history.length > 20) {
    treeState.history = treeState.history.slice(0, 20);
  }
  updateHistoryUI();
  saveToLocalStorage();
}

function updateHistoryUI() {
  const historyContainer = document.getElementById("colorHistory");
  if (treeState.history.length === 0) {
    historyContainer.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">履歴がありません</div>';
    return;
  }
  historyContainer.innerHTML = treeState.history.slice(0, 10).map(item => `
    <div class="history-item" onclick="applyHistoryColor('${item.hex}')">
      <div class="history-color" style="background-color:${item.hex}"></div>
      <div class="history-info">
        <div class="history-hex">${item.hex}</div>
        <div class="history-time">${formatTime(item.timestamp)} - ${item.rule}</div>
      </div>
    </div>
  `).join("");
}

function applyHistoryColor(hex) {
  document.getElementById("hexInput").value = hex;
  document.getElementById("colorPicker").value = hex;
  setRootColor();
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function updateStats() {
  const totalNodes = Object.keys(treeState.nodes).length;
  const adoptedNodes = Object.values(treeState.nodes).filter(n => n.state === "adopted").length;
  document.getElementById("totalNodes").textContent = totalNodes;
  document.getElementById("adoptedNodes").textContent = adoptedNodes;
}

function clearHistory() {
  if (!confirm("履歴をクリアするとツリーも削除されます。実行しますか？")) return;
  treeState.nodes = {};
  treeState.edges = [];
  treeState.history = [];
  treeState.rootId = null;
  treeState.selectedNodeId = null;
  renderTree();
  updateSelectedNodeInfo();
  updateStats();
  updateHistoryUI();
  saveToLocalStorage();
  showNotification("履歴とツリーをクリアしました", "success");
}

// =============================
// UI更新（選択情報など）
// =============================
function setRootColor() {
  const hex = document.getElementById("hexInput").value;
  if (!/^#?[0-9A-F]{6}$/i.test(hex)) {
    showNotification("無効なHEX形式です", "error");
    return;
  }
  const normalizedHex = hex.startsWith("#") ? hex : "#" + hex;
  treeState.nodes = {};
  treeState.edges = [];
  treeState.selectedNodeId = null;

  const rootNode = createColorNode(normalizedHex);
  rootNode.state = "adopted";
  addNode(rootNode);
  treeState.rootId = rootNode.id;

  centerView();
  renderTree();
  selectNode(rootNode.id);
  showNotification("起点色に設定しました", "success");

  // 起点設定後に分岐ボタンを有効化
  updateBranchButtonsState(true, normalizedHex);
}

function generateBranch(type) {
  const selectedId = treeState.selectedNodeId;
  if (!selectedId) {
    showNotification("色のノードを選択してから分岐を生成してください", "warning");
    return;
  }
  const baseNode = treeState.nodes[selectedId];
  if (baseNode.depth >= treeState.maxDepth) {
    showNotification(`最大深度${treeState.maxDepth}に達しています`, "warning");
    return;
  }

  let newNodes = [];
  switch (type) {
    case "analogous": newNodes = deriveAnalogous(baseNode); break;
    case "complementary": newNodes = deriveComplementary(baseNode); break;
    case "split": newNodes = deriveSplitComplementary(baseNode); break;
    case "triad": newNodes = deriveTriad(baseNode); break;
    case "tetrad": newNodes = deriveTetrad(baseNode); break;
    case "tint": newNodes = deriveTint(baseNode); break;
    case "shade": newNodes = deriveShade(baseNode); break;
    case "tone": newNodes = deriveTone(baseNode); break;
  }

  newNodes.forEach(addNode);
  renderTree();
  showNotification(`${baseNode.hex}から${type}を生成しました`, "success");
}

function setNodeState(state) {
  if (!treeState.selectedNodeId) return;
  treeState.nodes[treeState.selectedNodeId].state = state;
  renderTree();
  updateSelectedNodeInfo();
  updateStats();
  saveToLocalStorage();
  const stateNames = { adopted: "採用", pending: "保留", rejected: "破棄" };
  showNotification(`色を${stateNames[state]}しました`, "info");
}

function selectNode(nodeId) {
  treeState.selectedNodeId = nodeId;
  document.querySelectorAll(".color-node").forEach(node => node.classList.remove("selected"));
  const selectedElement = document.querySelector(`[data-node-id="${nodeId}"]`);
  if (selectedElement) selectedElement.classList.add("selected");
  updateSelectedNodeInfo();
}

function updateSelectedNodeInfo() {
  const nodeId = treeState.selectedNodeId;
  const currentSelectionArea = document.getElementById("currentSelectionArea");
  const selectionHint = document.getElementById("selectionHint");
  const branchButtons = document.querySelectorAll(".btn-branch");

  if (!nodeId || !treeState.nodes[nodeId]) {
    currentSelectionArea.classList.remove("show");
    selectionHint.style.display = "block";
    branchButtons.forEach(btn => btn.disabled = true);
    return;
  }

  currentSelectionArea.classList.add("show");
  selectionHint.style.display = "none";
  branchButtons.forEach(btn => btn.disabled = false);

  const node = treeState.nodes[nodeId];
  document.getElementById("selectedNodeDisplay").textContent = node.derivation.rule;
  document.getElementById("selectedNodeHex").textContent = node.hex;
  document.getElementById("popup-hex").textContent = node.hex;
  document.getElementById("popup-rgb").textContent = `rgb(${node.rgb.r},${node.rgb.g},${node.rgb.b})`;
  document.getElementById("popup-hsl").textContent = `hsl(${node.hsl.h},${node.hsl.s}%,${node.hsl.l}%)`;
  document.getElementById("popup-css-var").textContent = `--color-${node.derivation.rule}: ${node.hex}`;

  document.querySelectorAll(".state-btn").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.querySelector(`.state-btn.${node.state}`);
  if (activeBtn) activeBtn.classList.add("active");
}
// =============================
// ツリー描画（ふにゃっと曲線）
// =============================
function renderTree() {
  const svg = document.getElementById("treeSvg");
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const positions = calculateNodePositions();

  // edges (カーブで描画)
  treeState.edges.forEach(edge => {
    const fromPos = positions[edge.from];
    const toPos = positions[edge.to];
    if (fromPos && toPos) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", "connection-line");

      const controlX = (fromPos.x + toPos.x) / 2;
      const d = `
        M ${fromPos.x},${fromPos.y}
        C ${controlX},${fromPos.y}
          ${controlX},${toPos.y}
          ${toPos.x},${toPos.y}
      `;
      path.setAttribute("d", d.trim());
      svg.appendChild(path);
    }
  });

  // nodes
  Object.values(treeState.nodes).forEach(node => {
    const pos = positions[node.id];
    if (!pos) return;

    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", `color-node ${node.state}`);
    group.setAttribute("data-node-id", node.id);
    group.setAttribute("transform", `translate(${pos.x},${pos.y})`);

    if (treeState.selectedNodeId === node.id) {
      const glowCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      glowCircle.setAttribute("r", node.depth === 0 ? 38 : 33);
      glowCircle.setAttribute("fill", "none");
      glowCircle.setAttribute("stroke", "var(--accent-color)");
      glowCircle.setAttribute("stroke-width", "3");
      glowCircle.setAttribute("opacity", "0.6");
      group.appendChild(glowCircle);
    }

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("r", node.depth === 0 ? 32 : 28);
    circle.setAttribute("fill", node.hex);
    circle.setAttribute("class", `node-circle ${node.state}`);
    group.appendChild(circle);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("class", "node-text");
    text.setAttribute("y", node.depth === 0 ? 46 : 42);
    text.setAttribute("font-size", "11");
    text.setAttribute("font-weight", "bold");
    text.textContent = node.hex;
    group.appendChild(text);

    if (node.derivation.rule !== "root") {
      const ruleText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      ruleText.setAttribute("class", "node-text");
      ruleText.setAttribute("y", node.depth === 0 ? 60 : 56);
      ruleText.setAttribute("font-size", "9");
      ruleText.setAttribute("opacity", "0.8");
      ruleText.textContent = node.derivation.rule;
      group.appendChild(ruleText);
    }

    group.addEventListener("click", e => {
      e.stopPropagation();
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
    const children = Object.values(treeState.nodes).filter(n => n.parentId === parentId);
    if (children.length === 0) return;
    const childY = parentY + verticalSpacing;
    const totalWidth = (children.length - 1) * horizontalSpacing;
    const startX = parentX - totalWidth / 2;
    children.forEach((node, i) => {
      const childX = startX + i * horizontalSpacing;
      positions[node.id] = { x: childX, y: childY };
      positionChildren(node.id, childX, childY);
    });
  }
  positionChildren(treeState.rootId, 0, 0);
  return positions;
}

// =============================
// ビューポート制御（ズーム＋移動）
// =============================
function updateViewport() {
  const svg = document.getElementById("treeSvg");
  if (svg) {
    svg.style.transform = `translate(${treeState.viewport.x}px,${treeState.viewport.y}px) scale(${treeState.viewport.scale})`;
  }
}

function centerView() {
  const container = document.getElementById("canvasContainer");
  const rect = container.getBoundingClientRect();
  treeState.viewport.x = rect.width / 2;
  treeState.viewport.y = rect.height / 2;
  treeState.viewport.scale = 1;
  updateViewport();
}

function setZoom(value) {
  treeState.viewport.scale = Math.max(0.2, Math.min(4, value));
  updateViewport();
  document.getElementById("zoomSlider").value = treeState.viewport.scale;
}

function zoomIn() { setZoom(treeState.viewport.scale * 1.2); }
function zoomOut() { setZoom(treeState.viewport.scale / 1.2); }

// =============================
// データ保存（Palette画像エクスポート専用）
// =============================
function exportPalette() {
  const nodes = Object.values(treeState.nodes);
  if (nodes.length === 0) {
    showNotification("エクスポートする色がありません", "warning");
    return;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const cardWidth = 200, cardHeight = 140, padding = 24;
  const cols = Math.min(nodes.length, Math.ceil(Math.sqrt(nodes.length)));
  const rows = Math.ceil(nodes.length / cols);
  const canvasWidth = cols * cardWidth + (cols + 1) * padding;
  const canvasHeight = rows * cardHeight + (rows + 1) * padding + 100;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  gradient.addColorStop(0, "#0a0a0a");
  gradient.addColorStop(1, "#1f1f1f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = "#4ecdc4";
  ctx.font = "bold 36px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("コネフラ - カラーパレット", canvasWidth / 2, 60);

  nodes.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = col * cardWidth + (col + 1) * padding;
    const y = row * cardHeight + (row + 1) * padding + 100;

    ctx.fillStyle = "#222";
    ctx.fillRect(x, y, cardWidth, cardHeight);

    ctx.fillStyle = node.hex;
    ctx.fillRect(x + 12, y + 12, cardWidth - 24, cardHeight - 60);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px monospace";
    ctx.fillText(node.hex, x + cardWidth / 2, y + cardHeight - 30);

    ctx.fillStyle = "#aaaaaa";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText(node.derivation.rule, x + cardWidth / 2, y + cardHeight - 10);
  });

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `conectfla-palette-${Date.now()}.png`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification("PNG画像を保存しました", "success");
  }, "image/png");
}

// =============================
// 通知
// =============================
function showNotification(message, type = "success") {
  const notification = document.getElementById("notification");
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.classList.add("show");
  setTimeout(() => notification.classList.remove("show"), 4000);
}

// =============================
// LocalStorage
// =============================
function saveToLocalStorage() {
  try { localStorage.setItem("conectfla-state", JSON.stringify(treeState)); }
  catch (e) { console.warn("save error:", e); }
}

function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem("conectfla-state");
    if (saved) {
      const data = JSON.parse(saved);
      treeState = { ...treeState, ...data };
      if (!treeState.history) treeState.history = [];
      updateHistoryUI();
      updateStats();
      if (Object.keys(treeState.nodes).length > 0) {
        renderTree();
        updateSelectedNodeInfo();
      }
    }
  } catch (e) { console.warn("load error:", e); }
}

// =============================
// 初期化
// =============================
function initialize() {
  try {
    loadFromLocalStorage();
    const defaultColor = "#4ECDC4";
    document.getElementById("hexInput").value = defaultColor;
    document.getElementById("colorPicker").value = defaultColor;
    if (Object.keys(treeState.nodes).length === 0) {
      setRootColor();
    } else {
      renderTree();
      updateSelectedNodeInfo();
      centerView();
    }
    showNotification("コネフラへようこそ！", "info");
  } catch (e) {
    console.error("Initialization error:", e);
    showNotification("初期化エラー", "error");
  }
}

document.addEventListener("DOMContentLoaded", initialize);
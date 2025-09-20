// =============================
// 状態
// =============================
let treeState = {
  version: 4.2,
  rootId: null,
  nodes: {},
  edges: [],
  maxDepth: 3,
  viewport: { x: 0, y: 0, scale: 1 },
  selectedNodeId: null,
  history: [],
  createdAt: Date.now()
};

// =============================
// 色変換
// =============================
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}
function rgbToHex(r, g, b) {
  const toHex = c => (Math.round(c).toString(16).padStart(2, '0'));
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
function rgbToHsl(r, g, b) {
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if(max===min){ h=s=0; }
  else{
    const d=max-min; s=l>0.5? d/(2-max-min): d/(max+min);
    switch(max){
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      case b: h=(r-g)/d+4; break;
    } h/=6;
  }
  return {h:Math.round(h*360), s:Math.round(s*100), l:Math.round(l*100)};
}
function hslToRgb(h,s,l){
  h/=360; s/=100; l/=100;
  const a=s*Math.min(l,1-l);
  const f=n=>{
    const k=(n+h*12)%12;
    return l - a*Math.max(Math.min(k-3, 9-k, 1), -1);
  };
  return { r:Math.round(f(0)*255), g:Math.round(f(8)*255), b:Math.round(f(4)*255) };
}

// =============================
// 派生生成
// =============================
function createColorNode(hex, parentId=null, rule='root', params={}) {
  const id = 'n' + Date.now() + Math.random().toString(36).slice(2,9);
  const rgb = hexToRgb(hex); const hsl = rgbToHsl(rgb.r,rgb.g,rgb.b);
  const depth = parentId ? (treeState.nodes[parentId].depth + 1) : 0;
  return { id, parentId, hex:hex.toUpperCase(), rgb, hsl,
           derivation:{rule, params}, state:'pending', depth, createdAt: Date.now() };
}
function addNode(node){
  treeState.nodes[node.id] = node;
  if(node.parentId) treeState.edges.push({from: node.parentId, to: node.id});
  addToHistory(node.hex, node.derivation.rule);
  updateStats();
}

function deriveAnalogous(base, delta=30){
  const hsl=rgbToHsl(base.rgb.r,base.rgb.g,base.rgb.b);
  return [-delta, +delta].map(off=>{
    const rgb=hslToRgb((hsl.h+off+360)%360, hsl.s, hsl.l);
    return createColorNode(rgbToHex(rgb.r,rgb.g,rgb.b), base.id, 'analogous', {delta: off});
  });
}
function deriveComplementary(base){
  const hsl=rgbToHsl(base.rgb.r,base.rgb.g,base.rgb.b);
  const rgb=hslToRgb((hsl.h+180)%360, hsl.s, hsl.l);
  return [createColorNode(rgbToHex(rgb.r,rgb.g,rgb.b), base.id, 'complementary')];
}
function deriveSplitComplementary(base, delta=30){
  const hsl=rgbToHsl(base.rgb.r,base.rgb.g,base.rgb.b);
  return [180-delta, 180+delta].map(off=>{
    const rgb=hslToRgb((hsl.h+off+360)%360, hsl.s, hsl.l);
    return createColorNode(rgbToHex(rgb.r,rgb.g,rgb.b), base.id, 'split', {offset: off});
  });
}
function deriveTriad(base){
  const hsl=rgbToHsl(base.rgb.r,base.rgb.g,base.rgb.b);
  return [120,240].map(off=>{
    const rgb=hslToRgb((hsl.h+off)%360, hsl.s, hsl.l);
    return createColorNode(rgbToHex(rgb.r,rgb.g,rgb.b), base.id, 'triad', {offset: off});
  });
}
function deriveTetrad(base){
  const hsl=rgbToHsl(base.rgb.r,base.rgb.g,base.rgb.b);
  return [90,180,270].map(off=>{
    const rgb=hslToRgb((hsl.h+off)%360, hsl.s, hsl.l);
    return createColorNode(rgbToHex(rgb.r,rgb.g,rgb.b), base.id, 'tetrad', {offset: off});
  });
}
function deriveTint(base, step=0.15){
  const hsl=rgbToHsl(base.rgb.r,base.rgb.g,base.rgb.b);
  return Array.from({length:3},(_,i)=>{
    const L=Math.min(95, hsl.l + step*100*(i+1));
    const rgb=hslToRgb(hsl.h, Math.max(10, hsl.s-5*(i+1)), L);
    return createColorNode(rgbToHex(rgb.r,rgb.g,rgb.b), base.id, 'tint', {step: i+1});
  });
}
function deriveShade(base, step=0.15){
  const hsl=rgbToHsl(base.rgb.r,base.rgb.g,base.rgb.b);
  return Array.from({length:3},(_,i)=>{
    const L=Math.max(5, hsl.l - step*100*(i+1));
    const rgb=hslToRgb(hsl.h, Math.min(100, hsl.s+3*(i+1)), L);
    return createColorNode(rgbToHex(rgb.r,rgb.g,rgb.b), base.id, 'shade', {step: i+1});
  });
}
function deriveTone(base, step=0.2){
  const hsl=rgbToHsl(base.rgb.r,base.rgb.g,base.rgb.b);
  return Array.from({length:3},(_,i)=>{
    const S=Math.max(5, hsl.s - step*100*(i+1));
    const rgb=hslToRgb(hsl.h, S, hsl.l);
    return createColorNode(rgbToHex(rgb.r,rgb.g,rgb.b), base.id, 'tone', {step: i+1});
  });
}
// =============================
// 履歴・統計
// =============================
function addToHistory(hex, rule){
  treeState.history.unshift({hex: hex.toUpperCase(), rule, timestamp: Date.now()});
  if(treeState.history.length>30) treeState.history.length = 30;
  updateHistoryUI(); saveToLocalStorage();
}
function updateHistoryUI(){
  const el=document.getElementById('colorHistory');
  if(!treeState.history.length){
    el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">履歴がありません</div>';
    return;
  }
  el.innerHTML = treeState.history.slice(0,20).map(item=>` <div class="history-item" onclick="applyHistoryColor('${item.hex}')"> <div class="history-color" style="background:${item.hex}"></div> <div class="history-info"> <div class="history-hex">${item.hex}</div> <div class="history-time">${new Date(item.timestamp).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})} - ${item.rule}</div> </div> </div>`).join('');
}
function applyHistoryColor(hex){
  document.getElementById('hexInput').value = hex;
  document.getElementById('colorPicker').value = hex;
  setRootColor();
}
function updateStats(){
  const all=Object.keys(treeState.nodes).length;
  const adopted=Object.values(treeState.nodes).filter(n=>n.state==='adopted').length;
  document.getElementById('totalNodes').textContent = all;
  document.getElementById('adoptedNodes').textContent = adopted;
}
function clearHistory(){
  if(!confirm('履歴とツリーをすべて削除します。よろしいですか？')) return;
  treeState.nodes={}; treeState.edges=[]; treeState.rootId=null;
  treeState.selectedNodeId=null; treeState.history=[];
  renderTree(); updateSelectedNodeInfo(); updateStats(); saveToLocalStorage();
  showNotification('履歴とツリーをクリアしました','success');
}

// =============================
// クリップボード機能（新規追加）
// =============================
function copyToClipboard(text) {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showNotification(`${text} をコピーしました`, 'success');
    }).catch(() => {
      fallbackCopyToClipboard(text);
    });
  } else {
    fallbackCopyToClipboard(text);
  }
}
function fallbackCopyToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showNotification(`${text} をコピーしました`, 'success');
  } catch (err) {
    showNotification('コピーに失敗しました', 'error');
  }
  document.body.removeChild(textArea);
}

// =============================
// UI基礎
// =============================
function updateBranchButtonsState(enable, baseColor='#4ECDC4'){
  document.querySelectorAll('.btn-branch').forEach(btn=>{
    if(enable){
      btn.classList.add('enabled');
      btn.style.backgroundColor = baseColor;
      btn.disabled = false;
    }else{
      btn.classList.remove('enabled');
      btn.style.backgroundColor = 'var(--border-color)';
      btn.disabled = true;
    }
  });
}
function setRootColor(){
  const hex = document.getElementById('hexInput').value;
  if(!/^#?[0-9A-F]{6}$/i.test(hex)){
    showNotification('無効なHEX形式です','error'); return;
  }
  const normalized = hex.startsWith('#')? hex: '#'+hex;
  treeState.nodes={}; treeState.edges=[]; treeState.selectedNodeId=null;
  const root = createColorNode(normalized);
  root.state='adopted'; addNode(root); treeState.rootId = root.id;
  renderTree(); selectNode(root.id);
  showNotification('起点色に設定しました','success');
  updateBranchButtonsState(true, normalized);
}
function generateBranch(type){
  const id = treeState.selectedNodeId;
  if(!id){ showNotification('色ノードを選択してから分岐を生成してください','warning'); return; }
  const base=treeState.nodes[id];
  if(base.depth >= treeState.maxDepth){
    showNotification(`最大深度${treeState.maxDepth}に達しています`,'warning'); return;
  }
  let newNodes=[];
  switch(type){
    case 'analogous': newNodes=deriveAnalogous(base); break;
    case 'complementary': newNodes=deriveComplementary(base); break;
    case 'split': newNodes=deriveSplitComplementary(base); break;
    case 'triad': newNodes=deriveTriad(base); break;
    case 'tetrad': newNodes=deriveTetrad(base); break;
    case 'tint': newNodes=deriveTint(base); break;
    case 'shade': newNodes=deriveShade(base); break;
    case 'tone': newNodes=deriveTone(base); break;
  }
  newNodes.forEach(addNode); renderTree();
  showNotification(`${base.hex}から${type}を生成しました`,'success');
}
function setNodeState(state){
  if(!treeState.selectedNodeId) return;
  treeState.nodes[treeState.selectedNodeId].state = state;
  renderTree(); updateSelectedNodeInfo(); updateStats(); saveToLocalStorage();
  const name={adopted:'採用',pending:'保留',rejected:'破棄'}[state];
  showNotification(`色を${name}しました`,'info');
}
function selectNode(nodeId){
  treeState.selectedNodeId = nodeId;
  document.querySelectorAll('.color-node').forEach(n=>n.classList.remove('selected'));
  const el=document.querySelector(`[data-node-id="${nodeId}"]`); if(el) el.classList.add('selected');
  updateSelectedNodeInfo();
}
function updateSelectedNodeInfo(){
  const id=treeState.selectedNodeId;
  const area=document.getElementById('currentSelectionArea');
  const hint=document.getElementById('selectionHint');
  const buttons=document.querySelectorAll('.btn-branch');
  if(!id || !treeState.nodes[id]){
    area.classList.remove('show'); hint.style.display='block';
    buttons.forEach(b=>b.disabled=true); return;
  }
  area.classList.add('show'); hint.style.display='none';
  buttons.forEach(b=>b.disabled=false);
  const node=treeState.nodes[id];
  document.getElementById('selectedNodeDisplay').textContent = node.derivation.rule;
  document.getElementById('selectedNodeHex').textContent = node.hex;
  document.getElementById('popup-hex').textContent = node.hex;
  document.getElementById('popup-rgb').textContent = `rgb(${node.rgb.r}, ${node.rgb.g}, ${node.rgb.b})`;
  document.getElementById('popup-hsl').textContent = `hsl(${node.hsl.h}, ${node.hsl.s}%, ${node.hsl.l}%)`;
  document.getElementById('popup-css-var').textContent = `--color-${node.derivation.rule}: ${node.hex}`;
  document.querySelectorAll('.state-btn').forEach(b=>b.classList.remove('active'));
  const active=document.querySelector(`.state-btn.${node.state}`); if(active) active.classList.add('active');
}
// =============================
// ツリー描画（C字カーブ、S字禁止）
// =============================
function calculateNodePositions(){
  const pos={}; if(!treeState.rootId) return pos;
  const H=200, V=160; // spacing
  pos[treeState.rootId] = {x:0,y:0};
  function walk(pid, px, py){
    const children = Object.values(treeState.nodes).filter(n=>n.parentId===pid);
    if(!children.length) return;
    const y = py + V;
    const totalW = (children.length-1)*H;
    const startX = px - totalW/2;
    children.forEach((n,i)=>{
      const x = startX + i*H;
      pos[n.id] = {x, y};
      walk(n.id, x, y);
    });
  }
  walk(treeState.rootId, 0, 0);
  return pos;
}

function renderTree(){
  const svg=document.getElementById('treeSvg'); if(!svg) return;
  while(svg.firstChild) svg.removeChild(svg.firstChild);
  const positions = calculateNodePositions();
  // C字カーブ（制御点を同じXにしてS字を防止）
  treeState.edges.forEach(e=>{
    const s=positions[e.from], d=positions[e.to];
    if(!s || !d) return;
    const cx = (s.x + d.x) / 2; // ← 同じXを共有
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class','connection-line');
    path.setAttribute('d', `M ${s.x},${s.y} C ${cx},${s.y} ${cx},${d.y} ${d.x},${d.y}`);
    svg.appendChild(path);
  });
  // ノード
  Object.values(treeState.nodes).forEach(node=>{
    const p=positions[node.id]; if(!p) return;
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('class',`color-node ${node.state}`);
    g.setAttribute('data-node-id',node.id);
    g.setAttribute('transform',`translate(${p.x},${p.y})`);

    if(treeState.selectedNodeId===node.id){
      const glow=document.createElementNS('http://www.w3.org/2000/svg','circle');
      glow.setAttribute('r', node.depth===0? 38: 33);
      glow.setAttribute('fill','none');
      glow.setAttribute('stroke','var(--accent-color)');
      glow.setAttribute('stroke-width','3');
      glow.setAttribute('opacity','0.6');
      g.appendChild(glow);
    }
    const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('r', node.depth===0? 32: 28);
    c.setAttribute('fill', node.hex);
    c.setAttribute('class',`node-circle ${node.state}`);
    g.appendChild(c);
    const t=document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('class','node-text');
    t.setAttribute('y', node.depth===0? 46: 42);
    t.setAttribute('font-size','11');
    t.setAttribute('font-weight','bold');
    t.textContent = node.hex;
    g.appendChild(t);
    if(node.derivation.rule!=='root'){
      const r=document.createElementNS('http://www.w3.org/2000/svg','text');
      r.setAttribute('class','node-text');
      r.setAttribute('y', node.depth===0? 60: 56);
      r.setAttribute('font-size','9');
      r.setAttribute('opacity','0.8');
      r.textContent = node.derivation.rule;
      g.appendChild(r);
    }
    g.addEventListener('click', ev=>{ ev.stopPropagation(); selectNode(node.id); });
    svg.appendChild(g);
  });
  // SVGの高さをツリーの深さから拡張（下パネルを押し下げる）
  const depths = Object.values(treeState.nodes).map(n=>n.depth);
  const maxDepth = depths.length ? Math.max(...depths) : 0;
  const svgHeight = maxDepth * 160 + 320; // 160=vertical spacing
  svg.style.height = `${svgHeight}px`;
  updateViewport();
}

// =============================
// ビューポート（ズームのみ。パンは無し）
// =============================
function updateViewport(){
  const svg=document.getElementById('treeSvg');
  if(svg){ svg.style.transform = `translate(${treeState.viewport.x}px, ${treeState.viewport.y}px) scale(${treeState.viewport.scale})`; }
}
function setZoom(v){
  const val = Math.max(0.5, Math.min(2.5, Number(v)));
  treeState.viewport.scale = val;
  const slider = document.getElementById('zoomSlider');
  if(slider) slider.value = val;
  updateViewport();
}
function zoomIn(){ setZoom(treeState.viewport.scale + 0.1); }
function zoomOut(){ setZoom(treeState.viewport.scale - 0.1); }

// =============================
// 出力（画像／コード）
// =============================
function adoptedOrAll(){
  const adopted = Object.values(treeState.nodes).filter(n=>n.state==='adopted');
  return adopted.length ? adopted : Object.values(treeState.nodes).sort((a,b)=>a.depth-b.depth);
}
function exportPaletteImage(){
  const mode = (document.querySelector('input[name="imageFormat"]:checked')||{}).value || 'horizontal';
  const nodes = adoptedOrAll();
  if(!nodes.length){ showNotification('エクスポートする色がありません','warning'); return; }
  // 高解像度
  const scale = 2; // @2x
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d');
  // レイアウトサイズ
  let w=1200, h=520;
  if(mode==='grid'){ w=1000; h = 200 + Math.ceil(nodes.length/5)*220; }
  if(mode==='circle'){ w=1000; h=600; }
  if(mode==='artist'){ w=1400; h=800; }
  canvas.width = w*scale; canvas.height = h*scale;
  ctx.scale(scale, scale);
  // 背景
  const grad = ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,'#0a0a0a'); grad.addColorStop(1,'#1a1a1a');
  ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#4ecdc4'; ctx.font='bold 36px Inter, sans-serif';
  ctx.textAlign='center'; ctx.fillText('Color Palette by コネフラ', w/2, 52);
  // 描画関数
  const drawCard = (x,y,size,hex,rule) =>{
    // swatch
    ctx.fillStyle = hex; ctx.fillRect(x, y, size, size);
    // label
    ctx.fillStyle = '#0f172a88'; ctx.fillRect(x, y+size-42, size, 42);
    ctx.fillStyle = '#e2e8f0'; ctx.font='bold 18px Inter, sans-serif'; ctx.textAlign='center';
    ctx.fillText(hex, x+size/2, y+size-18);
    ctx.fillStyle='#aab4c3'; ctx.font='12px Inter, sans-serif';
    ctx.fillText(rule, x+size/2, y+size-4);
  };
  if(mode==='horizontal'){
    const size = Math.min(180, Math.floor((w-120)/nodes.length));
    let x=60, y=100;
    nodes.forEach(n=>{ drawCard(x,y,size,n.hex,n.derivation.rule); x += size+24; });
  }
  else if(mode==='grid'){
    const cols = 5, size = 160, padX=40, padY=100, gap=24;
    nodes.forEach((n,i)=>{
      const col = i%cols, row = Math.floor(i/cols);
      const x = padX + col*(size+gap);
      const y = padY + row*(size+gap);
      drawCard(x,y,size,n.hex,n.derivation.rule);
    });
  }
  else if(mode==='circle'){
    const cx = w/2, cy = 320, R = 180;
    nodes.forEach((n,i)=>{
      const ang = (i/nodes.length)*Math.PI*2 - Math.PI/2;
      const x = cx + Math.cos(ang)*R - 70;
      const y = cy + Math.sin(ang)*R - 70;
      drawCard(x,y,140,n.hex,n.derivation.rule);
    });
  }
  else if(mode==='artist'){
    // 左に大きい主色、右に補助色グリッド
    const main = nodes[0];
    drawCard(60,120,320, main.hex, main.derivation.rule);
    const rest = nodes.slice(1);
    const cols=4, size=140, startX=450, startY=120, gap=24;
    rest.forEach((n,i)=>{
      const col=i%cols, row=Math.floor(i/cols);
      drawCard(startX+col*(size+gap), startY+row*(size+gap), size, n.hex, n.derivation.rule);
    });
  }
  canvas.toBlob(async (blob)=>{
    const fileName = `conefla-palette-${Date.now()}.png`;
    try{
      if(navigator.canShare && navigator.canShare({ files: [new File([blob],'palette.png',{type:'image/png'})] })){
        const file = new File([blob], fileName, { type: 'image/png' });
        await navigator.share({ files: [file], title: 'パレット画像', text: 'コネフラで生成' });
        showNotification('共有シートを開きました','success');
      }else{
        const url = URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=url; a.download=fileName; a.click();
        URL.revokeObjectURL(url);
        showNotification('PNG画像を保存しました（ファイルアプリ等から写真へ）','success');
      }
    }catch(e){
      console.error(e);
      showNotification('保存/共有に失敗しました','error');
    }
  },'image/png');
}
function exportCode(){
  const fmt = (document.querySelector('input[name="codeFormat"]:checked')||{}).value || 'css';
  const nodes = adoptedOrAll(); if(!nodes.length){ showNotification('出力対象がありません','warning'); return; }
  let content='';
  if(fmt==='css'){
    content = `:root{\n` + nodes.map((n,i)=>`  --color-${n.derivation.rule}${i+1}: ${n.hex};`).join('\n') + `\n}\n`;
  }else if(fmt==='scss'){
    content = nodes.map((n,i)=>`$color-${n.derivation.rule}${i+1}: ${n.hex};`).join('\n')+'\n';
  }else{ // json
    const json = nodes.map(n=>({rule:n.derivation.rule, hex:n.hex, rgb:n.rgb, hsl:n.hsl}));
    content = JSON.stringify({version:treeState.version, colors: json}, null, 2);
  }
  const blob = new Blob([content], {type: fmt==='json'?'application/json':'text/plain'});
  const url = URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download = `conefla-colors-${fmt}-${Date.now()}.${fmt==="json"?"json":fmt}`;
  a.click(); URL.revokeObjectURL(url);
  showNotification('コードを書き出しました','success');
}

// =============================
// 通知 & 保存
// =============================
function showNotification(msg,type='success'){
  const el=document.getElementById('notification');
  el.textContent = msg; el.className=`notification ${type}`; el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 4000);
}
function saveToLocalStorage(){
  try{
    localStorage.setItem('conefla-state', JSON.stringify(treeState));
  }catch(e){
    console.error('localStorage save failed:', e);
  }
}
function loadFromLocalStorage(){
  try{
    const s = localStorage.getItem('conefla-state');
    if(!s) return;
    const data=JSON.parse(s);
    treeState={...treeState, ...data};
    if(!treeState.history) treeState.history=[];
    updateHistoryUI();
    updateStats();
  }catch(e){
    console.error('localStorage load failed:', e);
  }
}

// =============================
// 初期化
// =============================
function initialize(){
  // 入力連動
  const picker=document.getElementById('colorPicker');
  const input=document.getElementById('hexInput');
  if(picker && input) {
    picker.addEventListener('change', e=>{
      input.value = e.target.value.toUpperCase();
    });
    input.addEventListener('input', e=>{
      let v=e.target.value.toUpperCase();
      if(v.length===6 && !v.startsWith('#')) v='#'+v;
      if(/^#[0-9A-F]{6}$/i.test(v)) picker.value=v;
    });
  }
  // ローカルストレージから復元
  loadFromLocalStorage();
  // デフォルト色の設定
  const defaultColor='#4ECDC4';
  if(!Object.keys(treeState.nodes).length){
    if(input) input.value=defaultColor;
    if(picker) picker.value=defaultColor;
    setRootColor();
  }else{
    renderTree();
    updateSelectedNodeInfo();
  }
  // 深度スライダの設定
  const depth=document.getElementById('maxDepth');
  const depthValue=document.getElementById('maxDepthValue');
  if(depth && depthValue) {
    depth.value = treeState.maxDepth;
    depthValue.textContent = treeState.maxDepth;
    depth.addEventListener('input', e=>{
      treeState.maxDepth = parseInt(e.target.value,10);
      depthValue.textContent = e.target.value;
      saveToLocalStorage();
    });
  }
  // ズームスライダがある場合の設定
  const zoomSlider = document.getElementById('zoomSlider');
  if(zoomSlider) {
    zoomSlider.value = treeState.viewport.scale;
    zoomSlider.addEventListener('input', e=>{
      setZoom(parseFloat(e.target.value));
    });
  }
  // SVGのクリックでノード選択解除
  const svg = document.getElementById('treeSvg');
  if(svg) {
    svg.addEventListener('click', e=>{
      if(e.target === svg) {
        treeState.selectedNodeId = null;
        updateSelectedNodeInfo();
        renderTree();
      }
    });
  }
  // 初期表示を更新
  updateBranchButtonsState(false);
  // ウェルカムメッセージ
  showNotification('コネフラへようこそ！','info');
}
// DOM読み込み完了時に初期化実行
document.addEventListener('DOMContentLoaded', initialize);
// 離脱時に状態を保存
window.addEventListener('beforeunload', saveToLocalStorage);
// エラーハンドリング
window.addEventListener('error', function(e) {
  console.error('Global error:', e.error);
  showNotification('予期しないエラーが発生しました', 'error');
});
// 未処理のPromise拒否をキャッチ
window.addEventListener('unhandledrejection', function(e) {
  console.error('Unhandled promise rejection:', e.reason);
  showNotification('処理中にエラーが発生しました', 'error');
});

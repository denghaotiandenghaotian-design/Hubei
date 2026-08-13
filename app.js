
/* ════════ 状态管理（localStorage） ════════ */
const LS = {
  profile:'lgx_profile', stats:'lgx_stats', errs:'lgx_errs',
  cards:'lgx_cards', log:'lgx_log', checkin:'lgx_checkin', exam:'lgx_exam'
};
const S = {
  profile: JSON.parse(localStorage.getItem(LS.profile)||'null') || {level:'省直',post:'',date:'',hours:2},
  stats:  JSON.parse(localStorage.getItem(LS.stats)||'null') || {quiz:0,right:0,err:0,days:0,lastDay:''},
  errs:   JSON.parse(localStorage.getItem(LS.errs)||'null') || [],
  cards:  JSON.parse(localStorage.getItem(LS.cards)||'null') || null,
  log:    JSON.parse(localStorage.getItem(LS.log)||'null') || [],
  exam:   JSON.parse(localStorage.getItem(LS.exam)||'null') || null
};
function save(key){ localStorage.setItem(LS[key], JSON.stringify(S[key])); }
function saveAll(){ save('profile');save('stats');save('errs');save('cards');save('log');save('exam'); if(BACKUP_DIR){ writeBackup(BACKUP_DIR); } }

/* ════════ 数据备份与恢复 ════════ */
let BACKUP_DIR=null;
function collectAllData(){
  const out={app:'湖北遴选AI复习系统',version:'3.3'};
  ['profile','stats','errs','cards','log','exam'].forEach(k=>out[k]=S[k]);
  out.imported=JSON.parse(localStorage.getItem('lgx_imported')||'[]');
  out.customKB=JSON.parse(localStorage.getItem('lgx_custom_kb')||'[]');
  out.customJin=JSON.parse(localStorage.getItem('lgx_custom_jin')||'[]');
  out.exportedAt=new Date().toISOString();
  return out;
}
function exportBackup(){
  const data=collectAllData();
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='湖北遴选学习数据备份_'+todayStr()+'.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  toast('✓ 备份文件已导出，请保存到 D:\\考试 文件夹');
}
function importBackup(file){
  if(!file) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const d=JSON.parse(r.result);
      if(!d||typeof d!=='object'){ throw new Error('bad'); }
      ['profile','stats','errs','cards','log','exam'].forEach(k=>{ if(d[k]!==undefined){ S[k]=d[k]; save(k); } });
      if(d.imported) localStorage.setItem('lgx_imported',JSON.stringify(d.imported));
      if(d.customKB) localStorage.setItem('lgx_custom_kb',JSON.stringify(d.customKB));
      if(d.customJin) localStorage.setItem('lgx_custom_jin',JSON.stringify(d.customJin));
      toast('✓ 数据恢复成功');
      render.dash();
    }catch(e){ toast('备份文件解析失败，请选择导出的备份文件'); }
  };
  r.readAsText(file);
}
async function connectBackupDir(){
  if(!window.showDirectoryPicker){ toast('当前浏览器不支持连接文件夹（请用 Chrome/Edge），可使用导出备份'); return; }
  try{
    const dir=await window.showDirectoryPicker({mode:'readwrite'});
    BACKUP_DIR=dir;
    document.getElementById('backup-status').textContent='已连接：'+dir.name;
    await writeBackup(dir);
    toast('✓ 已连接文件夹「'+dir.name+'」，数据将自动备份');
  }catch(e){ /* 用户取消或失败 */ }
}
function disconnectBackupDir(){
  BACKUP_DIR=null;
  const st=document.getElementById('backup-status');
  if(st) st.textContent='未连接';
  toast('已断开自动备份（本地数据不受影响）');
}
async function writeBackup(dir){
  try{
    const data=collectAllData();
    const fh=await dir.getFileHandle('湖北遴选学习数据备份.json',{create:true});
    const w=await fh.createWritable();
    await w.write(JSON.stringify(data,null,2));
    await w.close();
  }catch(e){ /* 静默：目录可能被移动或权限变化 */ }
}
function addLog(type, title, result){
  S.log.unshift({t:new Date().toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}), type, title, result});
  S.log = S.log.slice(0,10); save('log');
}
function initCards(){
  if(S.cards) return;
  S.cards = EXAM_BANK.singleChoice.map(q=>({
    f:q.q, b:q.opts[q.ans]+'　·　'+q.explain, lv:1, due:0, next:Date.now()
  }));
  save('cards');
}
function todayStr(){ const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }

/* ════════ 导航 ════════ */
document.querySelectorAll('nav.tabs button').forEach(b=>{
  b.onclick=()=>{ document.querySelectorAll('nav.tabs button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
    document.getElementById('pg-'+b.dataset.pg).classList.add('on');
    render[b.dataset.pg] && render[b.dataset.pg]();
  };
});
const render = {};

/* ════════ 仪表盘 ════════ */
render.dash = function(){
  const P=S.profile, st=S.stats;
  document.getElementById('dash-date').textContent = '数据更新：'+new Date().toLocaleString('zh-CN');
  if(P.date){
    const days = Math.ceil((new Date(P.date) - new Date())/86400000);
    const stage = days>60?'基础期':days>30?'强化期':'冲刺期';
    document.getElementById('dash-countdown').innerHTML =
      '距离笔试 <b style="color:#e2a252">'+days+'</b> 天 · 当前阶段：<b style="color:#e2a252">'+stage+'</b>'
      +(days<=14?' · <span style="color:#e2635b">进入冲刺，建议每日全真模考</span>':'');
  }
  const acc = st.quiz>0 ? Math.round(st.right/st.quiz*100)+'%' : '--';
  document.getElementById('st-quiz').textContent=st.quiz;
  document.getElementById('st-acc').textContent=acc;
  document.getElementById('st-err').textContent=S.errs.length;
  document.getElementById('st-days').textContent=st.days;
  // 今日任务
  const due = S.errs.filter(e=>!e.mastered && e.next<=Date.now());
  const dueCards = S.cards?S.cards.filter(c=>c.next<=Date.now()).length:0;
  const undone = S.errs.length - S.errs.filter(e=>e.mastered).length;
  document.getElementById('dash-today').innerHTML =
    '<div>📌 待回顾错题：<b style="color:#e2a252">'+due.length+'</b> 题（未掌握共 '+undone+' 题）</div>'+
    '<div>📖 今日到期背诵卡：<b style="color:#e2a252">'+dueCards+'</b> 张</div>'+
    '<div style="margin-top:8px;">'+
    (due.length?'<button class="btn sm" onclick="goPage(\'err\',()=>errFilter(\'due\'))">去回顾错题</button> ':'')+
    (dueCards?'<button class="btn sm ghost" onclick="goPage(\'card\',()=>nextCard(true))">去背诵</button> ':'')+
    '<button class="btn sm ghost" onclick="goPage(\'quiz\',null)">去刷题</button></div>';
  // 记录
  const tb=document.getElementById('dash-log');
  tb.innerHTML = S.log.length? S.log.map(l=>'<tr><td>'+l.t+'</td><td>'+l.type+'</td><td>'+l.title+'</td><td>'+l.result+'</td></tr>').join('')
    :'<tr><td colspan="4" class="mut" style="text-align:center">暂无记录，开始第一次学习吧</td></tr>';
};
function goPage(pg, after){ document.querySelector('nav.tabs button[data-pg="'+pg+'"]').click(); if(after) after(); }
function saveProfile(){
  S.profile.level=document.getElementById('pf-level').value;
  S.profile.post=document.getElementById('pf-post').value;
  S.profile.date=document.getElementById('pf-date').value;
  S.profile.hours=parseInt(document.getElementById('pf-hours').value)||2;
  save('profile'); render.dash();
  alert('档案已保存 ✓');
}

/* ════════ 考点库 ════════ */
function getCustomKB(){ return JSON.parse(localStorage.getItem('lgx_custom_kb')||'[]'); }
function addCustomKB(){
  const cat=document.getElementById('kb-add-cat').value;
  const name=document.getElementById('kb-add-name').value.trim();
  const note=document.getElementById('kb-add-note').value.trim();
  const freq=document.getElementById('kb-add-freq').value;
  if(!name){ toast('请填写考点名称'); return; }
  const arr=getCustomKB();
  if(arr.some(x=>x.name===name&&x.cat===cat)){ toast('该考点已存在，自动去重'); return; }
  arr.push({cat:cat,name:name,note:note,freq:freq,custom:true});
  localStorage.setItem('lgx_custom_kb',JSON.stringify(arr));
  document.getElementById('kb-add-name').value=''; document.getElementById('kb-add-note').value='';
  render.kb(); toast('✓ 已添加自定义考点：'+name);
}
function delCustomKB(i){
  const arr=getCustomKB(); arr.splice(i,1);
  localStorage.setItem('lgx_custom_kb',JSON.stringify(arr));
  render.kb(); toast('已删除自定义考点');
}
render.kb = function(){
  const imported = JSON.parse(localStorage.getItem('lgx_imported')||'[]');
  const custom = getCustomKB();
  const el=document.getElementById('kb-list');
  const impHtml = imported.length
    ? '<div class="card" style="border-color:var(--gold);grid-column:1/-1;"><h3>思维导图导入 <span class="chip">'+imported.length+' 项</span> <span class="chip gray">科目：理论 · 来源：思维导图导入</span></h3>'+
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">'+
      imported.map(n=>'<span class="chip blue" style="font-size:12.5px;padding:5px 12px;">L'+n.lvl+' '+n.name+'</span>').join('')+
      '</div><div style="margin-top:10px;"><button class="btn sm danger" onclick="clearImported()">清空导入项</button></div></div>'
    : '';
  const customHtml = custom.length
    ? '<div class="card" style="border-color:var(--gold);grid-column:1/-1;"><h3>我的自定义考点 <span class="chip">'+custom.length+' 个</span> <span class="chip gray">用户添加</span></h3>'+
      custom.map((c,i)=>'<div class="box" style="padding:10px 12px;margin:6px 0;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">'+
        '<div><span class="chip">'+c.cat+'</span> <b style="color:#f0c182">'+c.name+'</b> <span class="chip gray">'+c.freq+'频</span>'+(c.note?'<div class="mut" style="font-size:12.5px;">'+c.note+'</div>':'')+'</div>'+
        '<div style="display:flex;gap:6px;"><button class="btn sm" onclick="openKbModal(\''+c.name.replace(/'/g,'')+'\',\''+(c.note||c.name).replace(/'/g,'').slice(0,80)+'\',\''+c.cat+'\')">解释与答题</button>'+
        '<button class="btn sm ghost" onclick="kbToCard(\''+c.name.replace(/'/g,'')+'\',\''+(c.note||c.name).replace(/'/g,'').slice(0,60)+'\')">加背诵卡</button>'+
        '<button class="btn sm danger" onclick="delCustomKB('+i+')">删除</button></div></div>').join('')+
      '</div>'
    : '';
  el.innerHTML = impHtml + customHtml + EXAM_BANK.domains.map(d=>{
    const qs = EXAM_BANK.papers.flatMap(p=>p.questions).filter(x=>x.domain===d.name);
    return '<div class="card"><h3>'+d.name+' <span class="chip">'+d.points.length+' 考点 · '+qs.length+' 道真题</span></h3>'+
      '<p class="mut" style="margin-bottom:8px;">'+d.desc+'</p>'+
      d.points.map(pt=>'<div class="box" style="padding:10px 12px;margin:6px 0;">'+
        '<div><b style="color:#f0c182">'+pt.name+'</b> <span class="chip gray">'+pt.freq+'频</span></div>'+
        '<div class="mut" style="font-size:12.5px;">'+pt.note+'</div>'+
        '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">'+
        '<button class="btn sm" onclick="openKbModal(\''+pt.name.replace(/'/g,'')+'\',\''+pt.note.replace(/'/g,'')+'\',\''+d.name+'\')">解释与答题</button>'+
        '<button class="btn sm ghost" onclick="kbToCard(\''+pt.name.replace(/'/g,'')+'\',\''+pt.note.replace(/'/g,'')+'\')">加入背诵卡</button></div></div>').join('')+
      '</div>';
  }).join('');
};
function kbToCard(name, note){
  initCards();
  S.cards.unshift({f:name, b:note, lv:1, due:0, next:Date.now()});
  save('cards'); alert('已加入背诵卡：「'+name+'」');
}
function clearImported(){
  localStorage.removeItem('lgx_imported');
  render.kb(); toast('已清空思维导图导入项');
}

/* ════════ 考点：解释与答题 ════════ */
let KB_MODAL={name:'',info:null};
function genKbFallback(name,note,cat){
  // 自定义考点通用生成（前端兜底）
  const ess=note||name;
  return {
    name:name,
    exp:'【概念内涵】“'+name+'”（'+cat+'领域）是遴选备考考点，核心要义在于：'+ess+'。\n【要点解析】'+ess+'。\n【命题视角】常考：概念识记、结合湖北实际谈举措、机关实务处置。作答做到理论与省情对接。\n【记忆提示】按“内涵—意义—举措”三要素记忆，先定性、再分层、后举例。',
    qs:[
      {type:'简答',q:'简述“'+name+'”的基本内涵和主要内容。',k:['内涵：明确其定位与实质','要点：'+ess,'结合最新政策表述'],a:'“'+name+'”是推动相关工作的重要理念/举措，其基本内涵是：'+ess+'。实践中要坚持目标导向与问题导向相结合，把部署要求转化为具体行动，确保落地见效。'},
      {type:'论述',q:'结合湖北实际，论述“'+name+'”在加快建成中部地区崛起重要战略支点中的意义与实践路径。',k:['意义：支撑支点建设','路径：3-4 条结合湖北举措','落点：高质量发展'],a:'推进“'+name+'”意义重大：一是有利于增强发展动能，支撑支点建设；二是有利于增进民生福祉；三是有利于提升治理效能。路径上，一要纳入全省“七大战略”统筹推进；二要项目化清单化落实；三要结合“51020”产业集群等省情实际精准发力；四要健全长效机制确保实效。'},
      {type:'案例',q:'某单位就“'+name+'”开展工作，请提出组织实施要点。',k:['摸清底数建台账','分类施策明责任','协同联动聚合力','建章立制促长效'],a:'一是摸清底数，全面排查建立台账；二是分类施策，制定针对性方案，明确责任人和时限；三是协同联动，部门配合、资源整合；四是加强督导，定期调度通报；五是建章立制，把有效做法固化为制度，实现长效常治。'}
    ]
  };
}
function openKbModal(name,note,cat){
  KB_MODAL.name=name;
  let info=EXAM_BANK.kbInfo && EXAM_BANK.kbInfo[name];
  if(!info){ info=genKbFallback(name,note||'',cat||''); }
  KB_MODAL.info=info;
  document.getElementById('kb-modal-title').textContent='考点详解 · '+name;
  const body=document.getElementById('kb-modal-body');
  body.innerHTML='<div class="box"><b style="color:#8fb4e8">▍全面解释</b>'+
    '<div style="font-size:14px;color:#c6d3e8;white-space:pre-wrap;margin-top:6px;">'+info.exp+'</div></div>'+
    info.qs.map((q,i)=>'<div class="box" style="border-color:var(--line);margin-top:10px;">'+
      '<span class="chip blue">'+(['一','二','三'][i])+' · '+q.type+'</span> <b style="color:#f0c182">'+q.q+'</b>'+
      '<div class="tip" style="margin:8px 0;"><b>答题要点：</b>'+q.k.join('；')+'</div>'+
      '<div style="border-top:1px dashed var(--line);padding-top:8px;"><b style="color:#6fbf8f">参考答案</b>'+
      '<div style="font-size:13.5px;color:#c6d3e8;margin-top:4px;white-space:pre-wrap;">'+q.a+'</div></div></div>').join('');
  document.getElementById('kb-modal').style.display='block';
}
function closeKbModal(){ document.getElementById('kb-modal').style.display='none'; }
function exportKbPDF(){
  const info=KB_MODAL.info; if(!info){ toast('暂无可导出内容'); return; }
  const w=window.open('','_blank');
  if(!w){ alert('请允许浏览器弹出窗口'); return; }
  const d=w.document;
  const body='<div class="q"><div class="qt"><b>【全面解释】</b></div><div class="a exp">'+info.exp.replace(/\n/g,'<br>')+'</div></div>'+
    info.qs.map(q=>'<div class="q"><div class="qt"><b>【'+q.type+'】</b>'+q.q+'</div>'+
      '<div class="k">答题要点：'+q.k.join('；')+'</div>'+
      '<div class="a">参考答案：'+q.a+'</div></div>').join('');
  d.write('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>考点详解 · '+info.name+'</title>'+
  '<style>@page{size:A4;margin:2cm 1.8cm;}body{font-family:SimSun,"宋体",serif;font-size:12pt;color:#111;line-height:1.9;}'+
  '.doc-title{text-align:center;font-size:19pt;font-weight:bold;letter-spacing:2px;border-top:3px double #000;border-bottom:3px double #000;padding:12px 0;margin-bottom:6px;}'+
  '.doc-sub{text-align:center;font-size:10.5pt;margin-bottom:16px;color:#333;}'+
  '.q{margin:10px 0;padding:10px 14px;border:1px solid #999;}'+
  '.qt{font-weight:bold;margin-bottom:4px;}'+
  '.k{color:#333;margin-bottom:4px;}'+
  '.a{text-indent:2em;}'+
  '.exp{text-indent:2em;}'+
  '.foot{text-align:center;font-size:9pt;color:#666;margin-top:20px;border-top:1px solid #999;padding-top:8px;}</style>'+
  '</head><body><div class="doc-title">考点详解 · '+info.name+'</div>'+
  '<div class="doc-sub">湖北遴选 AI 复习系统 · 解释与答题（简答/论述/案例）· 供练习对照</div>'+body+
  '<div class="foot">湖北遴选 AI 复习系统 · 考点解释与配套练习导出</div></body></html>');
  d.close();
  setTimeout(()=>{ w.focus(); w.print(); },300);
}


/* ════════ 智能刷题 ════════ */
let QZ={mode:'mc', idx:0, list:[], domain:'all'};
function setQuizMode(m){
  QZ.mode=m; QZ.idx=0; QZ.domain='all';
  document.getElementById('qz-mode-mc').className='btn sm'+(m==='mc'?'':' ghost');
  document.getElementById('qz-mode-sub').className='btn sm'+(m==='sub'?'':' ghost');
  buildQuizList(); renderQuizFilter(); qzShow();
}
function buildQuizList(){
  QZ.list = QZ.mode==='mc'
    ? EXAM_BANK.singleChoice.map((q,i)=>({kind:'mc', i, q}))
    : EXAM_BANK.papers.flatMap(p=>p.questions.map(q=>({kind:'sub', q})));
  if(QZ.domain!=='all') QZ.list = QZ.list.filter(x=>x.q.domain===QZ.domain || (x.kind==='mc'&&x.q.domain===QZ.domain));
}
function renderQuizFilter(){
  const el=document.getElementById('qz-domain-filter');
  const doms=['all'].concat(EXAM_BANK.domains.map(d=>d.name));
  el.innerHTML=doms.map(d=>'<button class="chip'+(QZ.domain===d?'':' gray')+'" onclick="setQzDomain(\''+d+'\')">'+d+'</button>').join('');
  document.getElementById('qz-filter-chips').textContent = QZ.mode==='mc'?'客观题 '+QZ.list.length+' 题':'主观题 '+QZ.list.length+' 题';
}
function setQzDomain(d){ QZ.domain=d; QZ.idx=0; buildQuizList(); renderQuizFilter(); qzShow(); }
function qzShow(){
  document.getElementById('qz-progress').innerHTML='第 '+(QZ.idx+1)+' / '+QZ.list.length+' 题';
  const stage=document.getElementById('qz-stage');
  if(QZ.idx>=QZ.list.length){ finishQuiz(); return; }
  const item=QZ.list[QZ.idx];
  if(item.kind==='mc') qzMc(item); else qzSub(item);
}
function qzMc(item){
  const q=item.q, stage=document.getElementById('qz-stage');
  stage.dataset.answered='0';
  stage.innerHTML='<span class="chip blue">'+q.domain+'</span><span class="chip gray">来源：'+q.source+'</span>'+
    '<h3 style="margin:10px 0;">'+(QZ.idx+1)+'. '+q.q+'</h3>'+
    q.opts.map((o,i)=>'<button class="opt" onclick="answerMc('+i+','+item.i+')"><b>'+(['A','B','C','D'][i])+'.</b> '+o+'</button>').join('');
}
function answerMc(sel, qi){
  const stage=document.getElementById('qz-stage');
  if(stage.dataset.answered==='1') return;
  stage.dataset.answered='1';
  const q=EXAM_BANK.singleChoice[qi], ok=sel===q.ans;
  document.querySelectorAll('#qz-stage .opt').forEach(el=>{ el.disabled=true; });
  S.stats.quiz++; if(ok) S.stats.right++; save('stats');
  // 标记选项
  document.querySelectorAll('#qz-stage .opt').forEach((el,i)=>{
    if(i===q.ans){ el.classList.add('correct'); }
    else if(i===sel && !ok){ el.classList.add('wrong'); }
  });
  if(!ok){
    addErr({kind:'客观题', title:q.q, ans:'你选'+['A','B','C','D'][sel]+'，正确'+['A','B','C','D'][q.ans], explain:q.explain, domain:q.domain, source:q.source});
  }
  addLog('刷题', q.domain+'·客观题', ok?'✓':'✗');
  const tip=document.createElement('div');
  tip.className='box'; tip.style.marginTop='12px';
  tip.innerHTML='<b style="color:'+(ok?'#6fbf8f':'#e2635b')+'">'+(ok?'回答正确 ✓':'回答错误 ✗')+'</b>　正确答案：<b style="color:#f0c182">'+['A','B','C','D'][q.ans]+'</b>'+
    '<div class="mut" style="margin-top:6px;">'+q.explain+'</div>'+
    '<div style="margin-top:10px;"><button class="btn sm" onclick="qzNext()">下一题 →</button></div>';
  stage.appendChild(tip);
}
function qzSub(item){
  const q=item.q, stage=document.getElementById('qz-stage');
  stage.innerHTML='<span class="chip blue">'+q.type+'</span><span class="chip">'+q.domain+'</span><span class="chip gray">共 '+q.score+' 分</span>'+
    '<h3 style="margin:10px 0;">'+q.title+'</h3>'+
    q.materials.map((m,i)=>'<div class="box" style="font-size:13.5px;color:#c6d3e8;">材料'+(q.materials.length>1?(i+1):'')+'：'+m.replace(/\n/g,'<br>')+'</div>').join('')+
    q.problems.map(p=>'<div class="box" style="border-color:var(--line);"><b style="color:#f0c182">'+p.n+'（'+p.score+'分）</b>　'+p.text+'<br><span class="mut">要求：'+p.req+'</span></div>').join('')+
    '<textarea id="qz-answer" placeholder="写下你的答题思路（可选，帮助自我检验）…"></textarea>'+
    '<div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">'+
    '<button class="btn sm" onclick="revealPoints()">对照参考思路</button>'+
    '<button class="btn sm ghost" onclick="qzSelf(true)">✓ 我掌握了</button>'+
    '<button class="btn sm danger" onclick="qzSelf(false)">✗ 没思路，记入错题</button></div>'+
    '<div id="qz-points" style="display:none;margin-top:12px;"></div>';
}
function revealPoints(){
  const item=QZ.list[QZ.idx], q=item.q;
  const box=document.getElementById('qz-points');
  box.style.display='block';
  box.innerHTML=q.problems.map(p=>'<div class="box"><b style="color:#f0c182">'+p.n+' · 参考思路</b>'+
    (p.points&&p.points.length?'<ul style="margin:6px 0 0 18px;">'+p.points.map(pt=>'<li style="font-size:13px;margin:3px 0;">'+pt+'</li>').join('')+'</ul>':'<div class="mut">暂无参考思路</div>')+
    (p.answer?'<div style="margin-top:8px;border-top:1px dashed var(--line);padding-top:8px;"><b style="color:#6fbf8f">参考作答</b><div style="font-size:13px;white-space:pre-wrap;margin-top:4px;color:#c6d3e8;">'+p.answer+'</div></div>':'')+
    '</div>').join('');
}
function qzSelf(ok){
  const item=QZ.list[QZ.idx], q=item.q;
  if(!ok){ S.errs.push({kind:'主观题', title:q.title, domain:q.domain, explain:'参考思路见下方', next:Date.now(), date:todayStr()}); save('errs'); }
  addLog('主观题训练', q.title, ok?'✓ 掌握':'✗ 记入错题');
  qzNext();
}
function qzNext(){ QZ.idx++; qzShow(); }
function finishQuiz(){
  const stage=document.getElementById('qz-stage');
  stage.innerHTML='<div style="text-align:center;padding:30px 0;"><div style="font-size:26px;color:#f0c182;">🎉 本轮完成</div>'+
    '<p class="mut" style="margin:10px 0 16px;">客观题正确率：'+Math.round(S.stats.right/S.stats.quiz*100)+'%　·　错题本共 '+S.errs.length+' 题</p>'+
    '<button class="btn" onclick="setQuizMode(\''+QZ.mode+'\')">再来一轮</button></div>';
  document.getElementById('qz-progress').innerHTML='完成';
}
function addErr(e){ e.mastered=false; e.date=todayStr(); e.next=Date.now(); S.errs.unshift(e); save('errs'); }

/* ════════ 模拟考试 ════════ */
let EX={pid:null, start:0, timer:null, ans:{}};
render.exam=function(){ renderPapers(); };
function renderPapers(){
  const groups=[['真题','近三年真题·考生回忆版（含参考解析）'],['模考','公选王 2026 实战模考'],['原创','AI 原创全真模拟（含标准答案）']];
  document.getElementById('ex-papers').innerHTML=groups.map(g=>{
    const ps=EXAM_BANK.papers.filter(p=>(p.group||'模考')===g[0]);
    return '<div style="margin:16px 0 8px;"><b style="color:#f0c182;font-size:14px;">▍'+g[0]+'卷 · '+g[1]+'</b></div>'+
      '<div style="display:flex;gap:10px;flex-wrap:wrap;">'+
      ps.map(p=>{
        const total=p.questions.reduce((s,q)=>s+q.score,0);
        return '<div class="box" style="cursor:pointer;flex:1;min-width:230px;" onclick="pickPaper(\''+p.id+'\',this)">'+
          '<div><b style="color:#f0c182">'+p.title+'</b></div>'+
          '<div style="margin-top:3px;"><span class="chip gray">'+p.questions.length+' 题 · '+total+' 分 · 180 分钟</span>'+(p.source?'<span class="chip blue">来源已注</span>':'')+'</div>'+
          (p.source?'<div class="mut" style="font-size:11.5px;margin-top:4px;">'+p.source+'</div>':'')+'</div>';
      }).join('')+'</div>';
  }).join('');
}
function pickPaper(pid,el){
  EX.pid=pid;
  document.querySelectorAll('#ex-papers .box').forEach(b=>b.style.borderColor='');
  el.style.borderColor='#e2a252';
}
function startExam(){
  if(!EX.pid){ alert('请先选择试卷'); return; }
  EX.start=Date.now(); EX.ans={};
  document.getElementById('ex-setup').style.display='none';
  document.getElementById('ex-result').style.display='none';
  document.getElementById('ex-run').style.display='block';
  const p=EXAM_BANK.papers.find(x=>x.id===EX.pid);
  document.getElementById('ex-title').textContent=p.id+' 卷 · 全真模拟（180 分钟）';
  renderExamBody(p);
  EX.timer=setInterval(()=>{
    const left=Math.max(0, 180*60-Math.floor((Date.now()-EX.start)/1000));
    document.getElementById('ex-clock').textContent=
      String(Math.floor(left/3600)).padStart(2,'0')+':'+String(Math.floor(left%3600/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
    if(left<=0){ clearInterval(EX.timer); submitExam(); }
  },1000);
  addLog('模拟考试', p.id+'卷开考', '进行中');
}
function renderExamBody(p){
  const el=document.getElementById('ex-body');
  el.innerHTML=p.questions.map((q,qi)=>
    '<div class="box" style="margin:14px 0;"><span class="chip blue">'+(qi+1)+'. '+q.type+'</span><span class="chip gray">'+q.score+' 分</span>'+
    '<h3 style="margin:8px 0;">'+q.title+'</h3>'+
    q.materials.map((m,i)=>'<div style="font-size:13.5px;color:#c6d3e8;margin:4px 0;">材料'+(q.materials.length>1?(i+1):'')+'：'+m.replace(/\n/g,'<br>')+'</div>').join('')+
    q.problems.map((p,pi)=>'<div style="margin-top:10px;"><b style="color:#f0c182">'+p.n+'（'+p.score+'分）</b>　'+p.text+
      '<br><span class="mut">要求：'+p.req+'</span></div>'+
      '<textarea data-q="'+qi+'" data-p="'+pi+'" placeholder="在此作答…" style="min-height:80px;">'+((EX.ans[qi+'-'+pi]||''))+'</textarea>').join('')+
    '</div>').join('');
  el.querySelectorAll('textarea').forEach(t=>t.oninput=()=>{ EX.ans[t.dataset.q+'-'+t.dataset.p]=t.value; });
}
function saveExamProgress(){ save('exam'); alert('进度已保存，可稍后恢复'); }
function loadSavedExam(){
  const s=S.exam; if(!s||!s.pid){ alert('暂无已保存进度'); return; }
  EX=s; startTimerFromSave();
  document.getElementById('ex-setup').style.display='none';
  document.getElementById('ex-result').style.display='none';
  document.getElementById('ex-run').style.display='block';
  const p=EXAM_BANK.papers.find(x=>x.id===EX.pid);
  document.getElementById('ex-title').textContent=p.id+' 卷 · 全真模拟（180 分钟）';
  renderExamBody(p);
}
function startTimerFromSave(){
  EX.timer=setInterval(()=>{
    const left=Math.max(0, 180*60-Math.floor((Date.now()-EX.start)/1000));
    document.getElementById('ex-clock').textContent=
      String(Math.floor(left/3600)).padStart(2,'0')+':'+String(Math.floor(left%3600/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
    if(left<=0){ clearInterval(EX.timer); submitExam(); }
  },1000);
}
function submitExam(){
  clearInterval(EX.timer);
  const p=EXAM_BANK.papers.find(x=>x.id===EX.pid);
  const used=Math.round((Date.now()-EX.start)/60000);
  // 自动保存未填内容
  document.querySelectorAll('#ex-run textarea').forEach(t=>{ EX.ans[t.dataset.q+'-'+t.dataset.p]=t.value; });
  save('exam');
  let rows='', total=0, selfTotal=0;
  p.questions.forEach((q,qi)=>{
    rows+='<tr><td>'+q.title+'</td><td>'+q.type+'</td><td>'+q.score+'</td>'+
      '<td><select data-q="'+qi+'" class="ex-self">'+[0,25,50,75,100].map(v=>'<option value="'+v+'">'+(v===0?'未答/0%':v+'%')+'</option>').join('')+'</select></td>'+
      '<td><button class="btn sm ghost" onclick="exReveal('+qi+')">参考思路</button></td></tr>';
  });
  const result=document.getElementById('ex-result');
  result.style.display='block';
  document.getElementById('ex-run').style.display='none';
  result.innerHTML='<h3>交卷完成 · 用时 '+used+' 分钟</h3>'+
    '<div class="tip">主观题按参考思路自评采分点覆盖率（0/25/50/75/100%），下方自动按比例换算得分。</div>'+
    '<table><thead><tr><th>题目</th><th>题型</th><th>分值</th><th>自评</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>'+
    '<div id="ex-reveal"></div>'+
    '<div style="margin-top:14px;"><button class="btn" onclick="exScore()">计算本次得分</button></div>'+
    '<div id="ex-score" style="margin-top:12px;font-size:16px;"></div>';
}
function exReveal(qi){
  const p=EXAM_BANK.papers.find(x=>x.id===EX.pid), q=p.questions[qi];
  const el=document.getElementById('ex-reveal');
  el.innerHTML='<div class="box"><b style="color:#f0c182">'+q.title+' · 参考思路与作答</b>'+
    q.problems.map(pr=>'<div style="margin-top:8px;"><b>'+pr.n+'</b>'+
      (pr.points&&pr.points.length?'<ul style="margin:4px 0 0 18px;">'+pr.points.map(pt=>'<li style="font-size:13px;">'+pt+'</li>').join('')+'</ul>':'')+
      (pr.answer?'<div style="margin-top:6px;border-top:1px dashed var(--line);padding-top:6px;"><b style="color:#6fbf8f">参考作答</b><div style="font-size:13px;white-space:pre-wrap;margin-top:4px;color:#c6d3e8;">'+pr.answer+'</div></div>':'')+
      '</div>').join('')+'</div>';
}
function exScore(){
  const p=EXAM_BANK.papers.find(x=>x.id===EX.pid);
  let total=0, got=0;
  document.querySelectorAll('.ex-self').forEach(sel=>{
    const qi=parseInt(sel.dataset.q), q=p.questions[qi], v=parseInt(sel.value);
    total+=q.score; got+=q.score*v/100;
  });
  const pct=Math.round(got/total*100);
  document.getElementById('ex-score').innerHTML=
    '本次预估得分：<b style="color:#e2a252;font-size:22px;">'+got.toFixed(1)+'</b> / '+total+' 分（自评合算 '+pct+'%）<br>'+
    '<span class="mut">目标参考：客观题权重低，主观题 70 分为决胜盘，策论文须 ≥60% 采分点。</span>';
  addLog('模拟考试', p.id+'卷交卷', got.toFixed(1)+'/'+total+'分');
  // 自评不足 50% 的主观题记入错题
  document.querySelectorAll('.ex-self').forEach(sel=>{
    if(parseInt(sel.value)<50){
      const qi=parseInt(sel.dataset.q), q=p.questions[qi];
      if(!S.errs.some(e=>e.title===q.title&&e.date===todayStr())) addErr({kind:'主观题', title:q.title, domain:q.domain, explain:'模考自评采分点不足，建议重练', source:p.id+'卷'});
    }
  });
  saveAll();
}
function abortExam(){ clearInterval(EX.timer); EX={pid:null,start:0,timer:null,ans:{}}; document.getElementById('ex-run').style.display='none'; document.getElementById('ex-setup').style.display='block'; }


/* ════════ 错题本 ════════ */
let EF='all';
function errFilter(f){
  EF=f;
  document.querySelectorAll('#pg-err .chip').forEach(c=>c.classList.remove('gray'));
  const map={all:0,'客观题':1,'主观题':2,due:3};
  document.querySelectorAll('#pg-err .chip')[map[f]].classList.add('gray');
  render.err();
}
render.err=function(){
  const el=document.getElementById('err-list');
  let list=S.errs.slice();
  if(EF==='客观题') list=list.filter(e=>e.kind==='客观题');
  if(EF==='主观题') list=list.filter(e=>e.kind==='主观题');
  if(EF==='due') list=list.filter(e=>!e.mastered&&e.next<=Date.now());
  if(!list.length){ el.innerHTML='<div class="card mut" style="text-align:center;">暂无错题，继续保持 💪</div>'; return; }
  el.innerHTML=list.map((e,i)=>{
    const due=e.mastered?'已掌握':(e.next<=Date.now()?'<span style="color:#e2635b">待复习</span>':'复习日 '+new Date(e.next).toLocaleDateString('zh-CN'));
    return '<div class="card" style="margin-bottom:10px;">'+
      '<div><span class="chip '+(e.kind==='客观题'?'blue':'gold')+'">'+e.kind+'</span><span class="chip gray">'+e.domain+'</span><span class="chip red">'+due+'</span></div>'+
      '<div style="margin:8px 0;"><b>'+e.title+'</b></div>'+
      (e.kind==='客观题'?'<div class="mut">'+e.ans+'</div><div class="mut" style="color:#6fbf8f;">'+e.explain+'</div>'
        :'<div class="mut">'+e.explain+'</div>')+
      '<div style="margin-top:8px;">'+
      (e.mastered?'':'<button class="btn sm" onclick="errMaster('+i+')">标记已掌握</button> ')+
      '<button class="btn sm ghost" onclick="errToCard('+i+')">转为背诵卡</button> '+
      '<button class="btn sm danger" onclick="errDel('+i+')">移除</button></div></div>';
  }).join('');
};
function errMaster(i){ S.errs[i].mastered=true; save('errs'); render.err(); }
function errToCard(i){
  const e=S.errs[i];
  initCards();
  S.cards.unshift({f:e.title.slice(0,40), b:e.explain, lv:1, due:0, next:Date.now()});
  save('cards'); alert('已转为背诵卡');
}
function errDel(i){ S.errs.splice(i,1); save('errs'); render.err(); }

/* ════════ 背诵卡 ════════ */
let CD={idx:0, queue:[], flipped:false};
render.card=function(){
  initCards();
  document.getElementById('cd-total').textContent=S.cards.length;
  const due=S.cards.filter(c=>c.next<=Date.now()).length;
  document.getElementById('cd-due-cnt').textContent='今日待背 '+due+' 张';
  const st=S.stats;
  document.getElementById('cd-status').innerHTML=
    '连续打卡 <b style="color:#e2a252">'+st.days+'</b> 天<br>'+
    '<span class="mut">上次打卡：'+(st.lastDay?st.lastDay:'—')+'</span>';
};
function nextCard(force){
  initCards();
  const due=S.cards.filter(c=>c.next<=Date.now());
  if(!force && !due.length){ alert('今日卡片已背完 🎉'); return; }
  const pool=due.length?due:S.cards.filter(c=>c.lv<5);
  CD.queue=pool.slice(); CD.idx=0; CD.flipped=false; cardShow();
}
function cardShow(){
  const stage=document.getElementById('cd-stage');
  if(!CD.queue.length){ stage.innerHTML='<div class="mut">卡片池已清空，去考点库添加新卡片吧</div>'; return; }
  const c=CD.queue[CD.idx];
  stage.innerHTML='<span class="chip gray">'+(CD.idx+1)+'/'+CD.queue.length+' · 等级 '+c.lv+'</span>'+
    '<div style="font-size:18px;font-weight:600;color:#f0c182;margin:18px 0 10px;">'+(CD.flipped?'『答案』':c.f)+'</div>'+
    (CD.flipped?'<div class="box">'+c.b+'</div>':'')+
    '<div style="margin-top:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">'+
    (CD.flipped
      ? '<button class="btn sm" onclick="cdRate(1)">忘记 · 重来</button><button class="btn sm" onclick="cdRate(2)">模糊</button><button class="btn sm" onclick="cdRate(3)">勉强</button><button class="btn sm" onclick="cdRate(4)">熟练</button><button class="btn sm" onclick="cdRate(5)">精通</button>'
      : '<button class="btn" onclick="cdFlip()">翻面看答案</button><button class="btn ghost" onclick="nextCard(true)">跳过</button>')+
    '</div>';
}
function cdFlip(){ CD.flipped=true; cardShow(); }
function cdRate(lv){
  const c=CD.queue[CD.idx];
  c.lv=lv; c.due=(c.due||0)+1;
  const gap=[1,3,7,15,30][Math.max(0,lv-1)]*86400000;
  c.next=Date.now()+gap;
  if(lv>=4){ c.next=Date.now()+gap*2; }
  save('cards');
  CD.idx++; CD.flipped=false;
  if(CD.idx>=CD.queue.length){ cardDone(); } else cardShow();
}
function cardDone(){
  document.getElementById('cd-stage').innerHTML='<div style="font-size:22px;color:#f0c182;">✅ 本轮背诵完成</div><p class="mut">共 '+CD.queue.length+' 张，休息一下</p>';
}
function checkin(){
  const t=todayStr();
  if(S.stats.lastDay===t){ alert('今天已打过卡'); return; }
  S.stats.days=(S.stats.lastDay===yesterday()?S.stats.days:0)+1;
  S.stats.lastDay=t; save('stats'); render.card(); render.dash();
  alert('打卡成功 · 连续 '+S.stats.days+' 天');
}
function yesterday(){ const d=new Date(); d.setDate(d.getDate()-1); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function addCard(){
  const f=document.getElementById('cd-new-q').value.trim(), b=document.getElementById('cd-new-a').value.trim();
  if(!f||!b){ alert('请填写正反面'); return; }
  initCards(); S.cards.unshift({f,b,lv:1,due:0,next:Date.now()}); save('cards');
  document.getElementById('cd-new-q').value=''; document.getElementById('cd-new-a').value='';
  render.card(); alert('已添加');
}
function exportCards(){
  initCards();
  const rows=S.cards.map((c,i)=>(i+1)+'. '+c.f+' → '+c.b).join('\n');
  navigator.clipboard?navigator.clipboard.writeText(rows).then(()=>alert('已复制 '+S.cards.length+' 张卡片到剪贴板')):alert(rows);
}

/* ════════ 复习计划 ════════ */
render.plan=function(){
  const P=S.profile, el=document.getElementById('plan-stage');
  if(!P.date){ el.innerHTML='<h3>设置档案</h3><div class="mut">请先在仪表盘设置笔试日期与每日可用时长。</div>'; return; }
  const days=Math.ceil((new Date(P.date)-new Date())/86400000);
  const stage=days>60?'基础期（建体系 · 全面过考点）':days>30?'强化期（刷题+专题突破）':'冲刺期（全真模考+查漏补缺）';
  const hours=P.hours||2;
  el.innerHTML='<h3>阶段规划</h3><div class="box">剩余 <b style="color:#e2a252">'+days+'</b> 天 · '+stage+'<br>'+
    '<span class="mut">每日可用 '+hours+' 小时 · 主观题训练建议占比 ≥60%</span></div>';
  // 今日清单
  const dueErr=S.errs.filter(e=>!e.mastered&&e.next<=Date.now()).length;
  const dueCards=S.cards?S.cards.filter(c=>c.next<=Date.now()).length:0;
  const notDone = S.stats.quiz<20;
  const items=[];
  items.push('① 背诵：到期卡 '+dueCards+' 张 + 新卡 2 张（约 20 分钟）');
  items.push('② 客观题：刷 10 题（政治理论/时政优先，约 15 分钟）');
  items.push('③ 主观题：1 道真题训练 + 对照参考思路（约 40 分钟）');
  if(dueErr) items.push('④ 错题回顾：'+dueErr+' 题（今日到期）');
  items.push('⑤ 复盘：记录错因，更新错题本（约 5 分钟）');
  document.getElementById('plan-today').innerHTML=items.map(i=>'<div style="margin:6px 0;">'+i+'</div>').join('');
  // 本周
  const week=['周一','周二','周三','周四','周五','周六','周日'];
  const themes=['政治理论+公文写作','时政热点+机关实务','主观题专练（案例分析）','客观题刷题+错题','主观题专练（公文/策论）','全真模拟考（3小时）','复盘+思维导图过薄弱点'];
  document.getElementById('plan-week').innerHTML='<table><thead><tr><th>日期</th><th>主题</th><th>重点</th></tr></thead><tbody>'+
    week.map((w,i)=>'<tr><td>'+w+'</td><td>'+themes[i]+'</td><td>'+(i===5?'限时 180 分钟全卷':'结合考点库与错题本短板')+'</td></tr>').join('')+'</tbody></table>';
};

/* ════════ 思维导图（搜索高亮 + 节点一览导入） ════════ */
let MIND_SEARCH='';
function mindSearch(kw){ MIND_SEARCH=(kw||'').trim(); render.mind(); }
function importNode(lvl,name,note){
  const arr=JSON.parse(localStorage.getItem('lgx_imported')||'[]');
  if(arr.some(x=>x.name===name)){ toast('已存在，自动去重跳过：「'+name+'」'); return; }
  arr.push({name:name, lvl:lvl, note:note||'', subj:'理论', src:'思维导图导入'});
  localStorage.setItem('lgx_imported', JSON.stringify(arr));
  toast('✓ 已导入考点库（理论/思维导图导入）：'+name);
}
function toast(msg){
  let t=document.getElementById('mini-toast');
  if(!t){ t=document.createElement('div'); t.id='mini-toast';
    t.style.cssText='position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:rgba(11,21,36,.96);border:1px solid #e2a252;color:#f0c182;padding:10px 20px;border-radius:10px;font-size:13px;z-index:999;box-shadow:0 6px 20px rgba(0,0,0,.4);transition:opacity .3s;max-width:80%;';
    document.body.appendChild(t); }
  t.textContent=msg; t.style.opacity='1';
  clearTimeout(t._timer); t._timer=setTimeout(()=>{ t.style.opacity='0'; },2000);
}
render.mind=function(){
  const kw=MIND_SEARCH;
  const root=document.getElementById('mind-root');
  const nodes=[]; // 节点一览
  let anyHit=false;
  const dimAll = kw!=='';
  const html=EXAM_BANK.domains.map(d=>{
    const qs=EXAM_BANK.papers.flatMap(p=>p.questions).filter(x=>x.domain===d.name);
    const weak=S.errs.filter(e=>e.domain===d.name).length;
    const hitD = kw && (d.name.includes(kw)||d.desc.includes(kw));
    if(kw && hitD) anyHit=true;
    const pts=d.points.map(pt=>{
      const hit = kw && (pt.name.includes(kw)||pt.note.includes(kw));
      if(kw && hit) anyHit=true;
      nodes.push({lvl:1, name:pt.name, note:pt.note});
      return '<div class="md-node" data-name="'+pt.name.replace(/'/g,'')+'" style="margin:8px 0;position:relative;padding-left:14px;'+
        (hit?'border:2px solid #e2a252;box-shadow:0 0 14px rgba(226,162,82,.55);border-radius:8px;padding:6px 10px;background:rgba(226,162,82,.10);':'')+
        (dimAll&&!hit&&!hitD?'opacity:.22;':'')+'">'+
        '<span style="color:#e2a252">├─</span> <b>'+pt.name+'</b> <span class="chip gray">'+pt.freq+'</span>'+
        '<div class="mut" style="font-size:12.5px;">'+pt.note+'</div></div>';
    }).join('');
    return '<div class="card" style="margin-bottom:10px;'+(dimAll&&!hitD&&!pts.includes('"hit"')?'opacity:.35;':'')+'">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;" onclick="this.parentNode.querySelector(\'.md-body\').style.display=this.parentNode.querySelector(\'.md-body\').style.display===\'none\'?\'\':\'none\'">'+
      '<h3 style="margin:0;">'+d.name+' <span class="chip">'+d.points.length+' 考点</span>'+(weak?' <span class="chip red">错题 '+weak+'</span>':'')+'</h3>'+
      '<span class="mut">▾</span></div>'+
      '<div class="md-body" style="display:none;margin-top:10px;padding-left:16px;border-left:2px solid var(--line);">'+pts+
      (qs.length?'<div style="margin-top:8px;color:#8fb4e8;font-size:12.5px;">关联真题：'+qs.map(q=>q.title).join('；')+'</div>':'')+
      '</div></div>';
  }).join('');
  root.innerHTML=kw&&!anyHit?('<div class="card mut" style="text-align:center;">未找到匹配「'+kw+'」的节点，试试其他关键词</div>')+html:html;
  // 节点一览（含 L0 领域 + L1 考点 + L2 要点）
  const all=[];
  EXAM_BANK.domains.forEach(d=>{ all.push({lvl:0,name:d.name,note:d.desc}); d.points.forEach(pt=>all.push({lvl:1,name:pt.name,note:pt.note})); });
  document.getElementById('mind-total').textContent=all.length+' 个节点';
  document.getElementById('mind-nodes').innerHTML=all.map(n=>
    '<div class="box" style="padding:8px 12px;margin:5px 0;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">'+
    '<div><span class="chip gray">L'+n.lvl+'</span> <b style="font-size:13px;">'+n.name+'</b>'+(n.note?'<div class="mut" style="font-size:11.5px;">'+n.note+'</div>':'')+'</div>'+
    '<button class="btn sm ghost" onclick="importNode('+n.lvl+',\''+n.name.replace(/'/g,'')+'\',\''+(n.note||'').replace(/'/g,'').slice(0,40)+'\')">导入考点库</button></div>').join('');
};

/* ════════ 省情专题（含导出 PDF） ════════ */
render.topics=function(){
  const el=document.getElementById('topics-list');
  el.innerHTML=EXAM_BANK.topics.map(t=>
    '<div class="card" style="margin-bottom:14px;">'+
      '<h3>'+t.title+' <span class="chip gray">'+t.tagline+'</span></h3>'+
      '<div class="box"><b style="color:#8fb4e8">省情背景</b><div style="font-size:13.5px;color:#c6d3e8;margin-top:4px;">'+t.bg+'</div></div>'+
      t.qs.map(q=>'<div class="box" style="border-color:var(--line);margin-top:8px;">'+
        '<span class="chip blue">'+q.type+'</span> <b style="color:#f0c182">'+q.q+'</b>'+
        '<div class="tip" style="margin:8px 0;"><b>答题要点：</b>'+q.k.join('；')+'</div>'+
        '<div style="border-top:1px dashed var(--line);padding-top:8px;"><b style="color:#6fbf8f">参考答案</b>'+
        '<div style="font-size:13.5px;color:#c6d3e8;margin-top:4px;white-space:pre-wrap;">'+q.a+'</div></div></div>').join('')+
    '</div>').join('');
};
function exportTopicsPDF(){
  const w=window.open('','_blank');
  if(!w){ alert('请允许浏览器弹出窗口'); return; }
  const d=w.document;
  const body=EXAM_BANK.topics.map(t=>
    '<div class="topic"><h2>'+t.title+'<span class="sub">（'+t.tagline+'）</span></h2>'+
    '<h3>【省情背景】</h3><p class="bg">'+t.bg+'</p>'+
    t.qs.map(q=>'<div class="q"><div class="qt"><b>【'+q.type+'】</b>'+q.q+'</div>'+
      '<div class="k">答题要点：'+q.k.join('；')+'</div>'+
      '<div class="a">参考答案：'+q.a+'</div></div>').join('')+
    '</div>').join('');
  d.write('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>湖北省情专题复习资料（基于2026年湖北省政府工作报告）</title>'+
  '<style>'+
  '@page{size:A4;margin:2cm 1.8cm;}'+
  'body{font-family:SimSun,"宋体",serif;font-size:12pt;color:#111;line-height:1.9;}'+
  '.doc-title{text-align:center;font-size:20pt;font-weight:bold;letter-spacing:2px;border-top:3px double #000;border-bottom:3px double #000;padding:12px 0;margin-bottom:4px;}'+
  '.doc-sub{text-align:center;font-size:11pt;margin-bottom:18px;color:#333;}'+
  '.topic{margin-bottom:22px;page-break-inside:avoid;}'+
  '.topic h2{font-size:15pt;border-left:6px solid #000;padding-left:10px;margin:14px 0 8px;}'+
  '.topic h2 .sub{font-size:11pt;font-weight:normal;color:#444;}'+
  '.topic h3{font-size:12.5pt;margin:8px 0 4px;}'+
  '.bg{text-indent:2em;margin:4px 0 10px;}'+
  '.q{margin:8px 0;padding:8px 12px;border:1px solid #999;}'+
  '.qt{font-weight:bold;margin-bottom:4px;}'+
  '.k{color:#333;margin-bottom:4px;}'+
  '.a{text-indent:2em;}'+
  '.foot{text-align:center;font-size:9pt;color:#666;margin-top:20px;border-top:1px solid #999;padding-top:8px;}'+
  '</style></head><body>'+
  '<div class="doc-title">湖北省情专题复习资料</div>'+
  '<div class="doc-sub">依据 2026 年 1 月 27 日湖北省政府工作报告（李殿勋省长）提炼 · 含简答/论述/案例三类题与参考答案</div>'+
  body+
  '<div class="foot">湖北遴选 AI 复习系统 · 省情专题导出 · 答题要点与参考答案供练习对照</div>'+
  '</body></html>');
  d.close();
  setTimeout(()=>{ w.focus(); w.print(); },300);
}

/* ════════ 金句库 ════════ */
let JIN_CAT='全部', JIN_LIST=[];
function getCustomJin(){ return JSON.parse(localStorage.getItem('lgx_custom_jin')||'[]'); }
function addCustomJin(){
  const cat=document.getElementById('jin-add-cat').value;
  const text=document.getElementById('jin-add-text').value.trim();
  const src=document.getElementById('jin-add-src').value.trim();
  if(!text){ toast('请填写金句内容'); return; }
  const arr=getCustomJin();
  if(arr.some(x=>x.text===text)){ toast('该金句已存在，自动去重'); return; }
  arr.push({cat:cat,text:text,src:src||'用户添加',custom:true});
  localStorage.setItem('lgx_custom_jin',JSON.stringify(arr));
  document.getElementById('jin-add-text').value=''; document.getElementById('jin-add-src').value='';
  render.jin(); toast('✓ 已添加自定义金句');
}
function delCustomJin(i){
  const arr=getCustomJin(); arr.splice(i,1);
  localStorage.setItem('lgx_custom_jin',JSON.stringify(arr));
  render.jin(); toast('已删除自定义金句');
}
function jinFilter(c){ JIN_CAT=c; render.jin(); }
function copyJin(i){
  const g=JIN_LIST[i];
  const txt='“'+g.text+'”——'+g.src;
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(()=>toast('已复制金句')); }
  else alert(txt);
}
render.jin=function(){
  const custom=getCustomJin();
  const cats=['全部','我的自定义'].concat([...new Set(EXAM_BANK.golden.map(g=>g.cat))]);
  document.getElementById('jin-cats').innerHTML=cats.map(c=>'<button class="chip'+(JIN_CAT===c?'':' gray')+'" onclick="jinFilter(\''+c+'\')">'+c+(c==='我的自定义'?'('+custom.length+')':'')+'</button>').join('');
  let list=[];
  if(JIN_CAT==='我的自定义'){ list=custom.slice(); }
  else if(JIN_CAT==='全部'){ list=custom.concat(EXAM_BANK.golden); }
  else { list=custom.filter(g=>g.cat===JIN_CAT).concat(EXAM_BANK.golden.filter(g=>g.cat===JIN_CAT)); }
  JIN_LIST=list;
  document.getElementById('jin-list').innerHTML=JIN_LIST.map((g,i)=>
    '<div class="card" style="margin-bottom:10px;">'+
      '<span class="chip '+(g.custom?'green':'blue')+'">'+g.cat+(g.custom?'·我的':'')+'</span><span class="chip gray">'+g.src+'</span>'+
      '<div style="margin:8px 0;font-size:15px;color:#f0c182;">“'+g.text+'”</div>'+
      '<button class="btn sm ghost" onclick="copyJin('+i+')">复制</button>'+
      (g.custom?' <button class="btn sm danger" onclick="delCustomJin('+i+')">删除</button>':'')+
      '</div>').join('');
};

/* ════════ 初始化 ════════ */
window.onload=function(){
  initCards();
  document.getElementById('pf-level').value=S.profile.level;
  document.getElementById('pf-post').value=S.profile.post;
  document.getElementById('pf-date').value=S.profile.date;
  document.getElementById('pf-hours').value=S.profile.hours;
  buildQuizList(); renderQuizFilter(); qzShow();
  render.dash();
};

// ==UserScript==
// @name         Better IRIS
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Better IRIS
// @match        https://www.iris.go.kr/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const PREFIX =
    'mainframe.baseFrame.form.divWork.form.divCenter.form.divWork.form.divMainFrame.form.';
  const NEW_COL_WIDTH = 150;
  const COL2_NEW_WIDTH = 214;
  const COL3_NEW_WIDTH = 210;
  const COL2_LEFT = 239;
  const COL3_LEFT = 453;
  const COL4_LEFT = 663;
  const COL5_LEFT = 720;
  const ACTION_LEFT = 846;

  const $ = (id) => document.getElementById(id);
  const $p = (suffix) => $(PREFIX + suffix);
  const observers = [];

  function waitForGrid(cb, maxWait = 30000) {
    const t0 = Date.now();
    const check = () => {
      if ($p('grdSend') && $p('grdSend.body.gridrow_0')) cb();
      else if (Date.now() - t0 < maxWait) setTimeout(check, 500);
    };
    check();
  }

  // ─── Get Nexacro form & dataset helpers ───────────────────
  function getMyRndForm() {
    try {
      const app = nexacro.getApplication();
      return app.mainframe.baseFrame.form.divWork.form.divCenter.form.divWork.form;
    } catch (_) { return null; }
  }

  function getDataset() {
    try {
      const form = getMyRndForm();
      return form.divMainFrame.form.dsSbjtList;
    } catch (_) { return null; }
  }

  // ─── 협약변경신청 direct navigation ───────────────────────
  function navigateToAgrtChngRqst(rowIndex) {
    const ds = getDataset();
    if (!ds) { alert('데이터를 찾을 수 없습니다.'); return; }

    const sbjtId    = ds.getColumn(rowIndex, 'sbjtId');
    const rndSbjtNo = ds.getColumn(rowIndex, 'rndSbjtNo');
    if (!sbjtId) { alert('과제 ID를 찾을 수 없습니다.'); return; }

    const argDetailObj = {
      sbjtId, rndSbjtNo,
      prgDuclCd: 'D0016', ptcDuclCd: 'D0261', dtlDuclCd: 'D0262',
      sbjtChngSe: 'AI3002', aendAgrtChngYn: 'N',
      sorgnAgrtChngYn: 'N', blngGovdSe: 'AR4001',
    };

    const app = nexacro.getApplication();
    const baseForm = app.mainframe.baseFrame.form;

    // Step 1: Navigate to (승인통보)협약변경신청 list page
    //         This properly tears down the 마이R&D layout (sidebar, header, etc.)
    baseForm.fnMenuOpenPrgm('P01535');

    // Step 2: Once the list page form has loaded, navigate to the detail page
    const waitForListPage = () => {
      try {
        const curForm = app.mainframe.baseFrame.form.divWork.form
                          .divCenter.form.divWork.form;
        if (curForm.name === 'AGRTCHNG0200_000' &&
            typeof curForm.gfnChangeScreen === 'function') {
          curForm.gfnChangeScreen('P01544', {}, argDetailObj);
          return;
        }
      } catch (_) {}
      setTimeout(waitForListPage, 300);
    };
    setTimeout(waitForListPage, 1000);
  }

  // ─── 성과등록 direct navigation ───────────────────────────
  function navigateToFrutReg(rowIndex) {
    const ds = getDataset();
    if (!ds) { alert('데이터를 찾을 수 없습니다.'); return; }

    const rndSbjtNo = ds.getColumn(rowIndex, 'rndSbjtNo');
    const sorgnNm   = ds.getColumn(rowIndex, 'sorgnNm');
    if (!rndSbjtNo) { alert('과제번호를 찾을 수 없습니다.'); return; }

    // Save navigation data in window before leaving 마이R&D
    window.__tmFrutNavData = { rndSbjtNo, sorgnNm };

    const app = nexacro.getApplication();
    const baseForm = app.mainframe.baseFrame.form;

    // Step 1: Navigate to 성과등록 page (P01490)
    baseForm.fnMenuOpenPrgm('P01490');

    // Step 2: Once the form loads, set search params and auto-search
    const waitAndSearch = () => {
      try {
        const curForm = app.mainframe.baseFrame.form.divWork.form
                          .divCenter.form.divWork.form;
        if (curForm.name !== 'FRUTREG0001_000' ||
            typeof curForm.fnSearch !== 'function') {
          setTimeout(waitAndSearch, 300);
          return;
        }

        const data = window.__tmFrutNavData;
        const commForm = curForm.divSearch.form.divSearchComm.form;

        // Set 연구개발과제번호
        curForm.divSearch.form.edtRndSbjtNoForSearch.set_value(data.rndSbjtNo);

        // Trigger search (auto-selects the only matching row)
        curForm.fnSearch();
      } catch (_) {
        setTimeout(waitAndSearch, 300);
      }
    };
    setTimeout(waitAndSearch, 1500);
  }

  // ─── header ───────────────────────────────────────────────
  function patchHeader() {
    const headRowBody =
      $p('grdSend.head.gridrow_-1:containerbody') ||
      $p('grdSend.head.gridrow_-1')?.children[0];
    if (!headRowBody || $('tm-action-header')) return;

    const layout = [
      { id: 'cell_-1_0', left: 0,         width: 113 },
      { id: 'cell_-1_1', left: 113,       width: 126 },
      { id: 'cell_-1_2', left: COL2_LEFT, width: COL2_NEW_WIDTH },
      { id: 'cell_-1_3', left: COL3_LEFT, width: COL3_NEW_WIDTH },
      { id: 'cell_-1_4', left: COL4_LEFT, width: 57  },
      { id: 'cell_-1_5', left: COL5_LEFT, width: 126 },
    ];
    layout.forEach((h) => {
      const cell = $p('grdSend.head.gridrow_-1.' + h.id);
      if (!cell) return;
      cell.style.left = h.left + 'px';
      cell.style.width = h.width + 'px';
      const txt = $p('grdSend.head.gridrow_-1.' + h.id + ':text');
      if (txt) txt.style.width = (h.width - 1) + 'px';
    });

    const hCell = document.createElement('div');
    hCell.id = 'tm-action-header';
    hCell.className = 'GridCellControl cell';
    hCell.style.cssText = [
      `left:${ACTION_LEFT}px`, 'top:0px', `width:${NEW_COL_WIDTH}px`, 'height:40px',
      'color:rgb(121,129,141)', 'font:15px PretendardGOVBold', 'direction:ltr',
      'border-right:1px solid rgb(231,236,244)',
      'border-bottom:1px solid rgb(231,236,244)',
      'border-left:none', 'border-top:none',
      'position:absolute', 'display:flex',
      'align-items:center', 'justify-content:center', 'box-sizing:border-box',
    ].join(';');
    const hTxt = document.createElement('div');
    hTxt.textContent = '액션';
    hTxt.style.cssText =
      'text-align:center;width:100%;height:100%;display:flex;align-items:center;justify-content:center;';
    hCell.appendChild(hTxt);
    headRowBody.appendChild(hCell);
  }

  // ─── body rows ────────────────────────────────────────────
  function patchBodyRow(r, ds) {
    const row = $p('grdSend.body.gridrow_' + r);
    if (!row) return;
    const container = row.children[0];
    if (!container || $('tm-action-body-' + r)) return;

    // Shrink col 2 (전문기관)
    const c2 = $p('grdSend.body.gridrow_' + r + '.cell_' + r + '_2');
    if (c2) {
      c2.style.width = COL2_NEW_WIDTH + 'px';
      const t = c2.querySelector('div[id$=":text"]');
      if (t) t.style.width = (COL2_NEW_WIDTH - 16) + 'px';
    }
    // Shrink col 3 (과제번호)
    const c3 = $p('grdSend.body.gridrow_' + r + '.cell_' + r + '_3');
    if (c3) {
      c3.style.left = COL3_LEFT + 'px';
      c3.style.width = COL3_NEW_WIDTH + 'px';
      const t = c3.querySelector('div[id$=":text"]');
      if (t) t.style.width = (COL3_NEW_WIDTH - 16) + 'px';
    }
    const c4 = $p('grdSend.body.gridrow_' + r + '.cell_' + r + '_4');
    if (c4) c4.style.left = COL4_LEFT + 'px';
    const c5 = $p('grdSend.body.gridrow_' + r + '.cell_' + r + '_5');
    if (c5) c5.style.left = COL5_LEFT + 'px';
    const c7 = $p('grdSend.body.gridrow_' + r + '.cell_' + r + '_7');
    if (c7) {
      c7.style.width = COL2_NEW_WIDTH + 'px';
      const t = c7.querySelector('div[id$=":text"]');
      if (t) t.style.width = (COL2_NEW_WIDTH - 16) + 'px';
    }
    const c8 = $p('grdSend.body.gridrow_' + r + '.cell_' + r + '_8');
    if (c8) {
      c8.style.left = COL3_LEFT + 'px';
      c8.style.width = COL3_NEW_WIDTH + 'px';
      const t = c8.querySelector('div[id$=":text"]');
      if (t) t.style.width = (COL3_NEW_WIDTH - 16) + 'px';
    }

    // ── role check ──
    const role = ds.getColumn(r, 'rscrRoleSeNm');
    const isPI = role === '연구책임자';

    // ── action cell ──
    const aCell = document.createElement('div');
    aCell.id = 'tm-action-body-' + r;
    aCell.className = 'GridCellControl cell';
    aCell.style.cssText = [
      `left:${ACTION_LEFT}px`, 'top:0px',
      `width:${NEW_COL_WIDTH}px`, 'height:60px',
      'color:rgb(85,85,85)', 'font:12px PretendardGOVRegular', 'direction:ltr',
      'border-top:none',
      'border-right:1px solid rgb(231,236,244)',
      'border-bottom:1px solid rgb(231,236,244)',
      'border-left:none',
      'position:absolute', 'display:flex', 'flex-direction:row',
      'align-items:center', 'justify-content:center', 'gap:4px',
      'box-sizing:border-box',
    ].join(';');

    // Mirror status + userstatus for selected/hover highlight
    const refCell = $p('grdSend.body.gridrow_' + r + '.cell_' + r + '_0');
    if (refCell) {
      const curS = refCell.getAttribute('status');
      if (curS) aCell.setAttribute('status', curS);
      const curU = refCell.getAttribute('userstatus');
      if (curU) aCell.setAttribute('userstatus', curU);
      const obs = new MutationObserver((muts) => {
        for (const m of muts) {
          const val = refCell.getAttribute(m.attributeName);
          if (val) aCell.setAttribute(m.attributeName, val);
          else aCell.removeAttribute(m.attributeName);
        }
      });
      obs.observe(refCell, { attributes: true, attributeFilter: ['userstatus', 'status'] });
      observers.push(obs);
    }

    const btnBase =
      'padding:3px 8px;color:white;border:none;border-radius:4px;cursor:pointer;font:11px PretendardGOVRegular;white-space:nowrap;';

    // 협약변경신청 — only for 연구책임자
    if (isPI) {
      const btn1 = document.createElement('button');
      btn1.textContent = '협약변경신청';
      btn1.style.cssText = btnBase + 'background:#E8873B;';
      btn1.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateToAgrtChngRqst(r);
      });
      aCell.appendChild(btn1);
    }

// 성과등록 — always shown
    const btn2 = document.createElement('button');
    btn2.textContent = '성과등록';
    btn2.style.cssText = btnBase + 'background:#4A90D9;';
    btn2.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateToFrutReg(r);
    });
    aCell.appendChild(btn2);

    container.appendChild(aCell);
  }

  // ─── entry point ──────────────────────────────────────────
  function addActionColumn() {
    patchHeader();
    const ds = getDataset();
    if (!ds) return;
    const rowCount = ds.getRowCount();
    for (let r = 0; r < rowCount; r++) patchBodyRow(r, ds);
  }

  // ─── kick off ─────────────────────────────────────────────
  waitForGrid(addActionColumn);

  const pageObserver = new MutationObserver(() => {
    if ($p('grdSend.body.gridrow_0') && !$('tm-action-header')) {
      observers.forEach((o) => o.disconnect());
      observers.length = 0;
      addActionColumn();
    }
  });
  pageObserver.observe(document.body, { childList: true, subtree: true });
})();

// ========================================================
// ORCID 논문 자동입력 v2.0 – Inline Section (iframe approach)
// ========================================================
(function () {
  'use strict';

  const SECTION_TOP = 400;           // insertion point (between grid and 성과 정보)
  const SECTION_HEIGHT_EXP = 560;    // expanded height
  const SECTION_HEIGHT_COL = 44;     // collapsed (header only)
  const IFRAME_HEIGHT_EXP = 520;
  const IFRAME_HEIGHT_COL = 44;
  const ORIGINAL_FORM_HEIGHT = 1645; // original nexainnercontainer height

  /* ─── helpers ─── */
  function getInnerContainer() {
    return document.querySelector(
      '#mainframe\\.baseFrame\\.modalPopup\\.form > .nexacontainer > .nexainnercontainer'
    );
  }

  /* ─── iframe HTML content ─── */
  function buildIframeHTML() {
    return `<!DOCTYPE html><html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{font-family:NotoSans,'Malgun Gothic',sans-serif;font-size:15px;color:#444;background:transparent;overflow:hidden;display:flex;flex-direction:column}
.hdr{display:flex;align-items:center;height:32px;margin-bottom:12px;flex-shrink:0}
.hdr-title{background:url('https://www.iris.go.kr/resources/nui/_resource_/_theme_/portal/images/img_WF_Title02.png') no-repeat 0 50%;font-family:NotoSansMedium,'Malgun Gothic',sans-serif;font-size:20px;color:rgb(24,55,98);padding-left:14px;line-height:32px;flex:1}
.btn{background:#fff;border:1px solid #aaabaf;border-radius:2px;font:15px NotoSans,'Malgun Gothic',sans-serif;color:#444;height:32px;padding:0 14px;cursor:pointer}
.btn:hover{background:#f5f6f8}
.bp{border:1px solid #d5d5d5;background:#fafbfc;border-radius:2px;padding:14px 16px;flex:1;display:flex;flex-direction:column;min-height:0}
.ir{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-shrink:0}
.ir label{min-width:70px}
.ir input[type=text]{width:240px;height:30px;border:1px solid #d5d5d5;border-radius:2px;padding:0 8px;font:15px NotoSans,'Malgun Gothic',sans-serif;color:#444;outline:none}
.ir input[type=text]:focus{border-color:#4a90d9;box-shadow:0 0 3px rgba(74,144,217,.3)}
.bs{background:#fff;border:1px solid #aaabaf;border-radius:2px;font:15px NotoSans,'Malgun Gothic',sans-serif;color:#444;height:30px;padding:0 16px;cursor:pointer;position:relative}
.bs:hover{background:#f5f6f8}
.bs .tt{display:none;position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:6px;background:#333;color:#fff;font-size:12px;padding:5px 10px;border-radius:4px;white-space:nowrap;z-index:100;pointer-events:none}
.bs:hover .tt{display:block}
.st{font-size:13px;color:#888;margin-left:8px}
.rc{border:1px solid #d5d5d5;background:#fff;flex:1;overflow-y:auto;border-radius:2px;min-height:0}
table{width:100%;border-collapse:collapse;font-size:13px}
thead tr{background:#f5f6f8;border-bottom:1px solid #d5d5d5}
th{padding:6px 8px;text-align:left;color:#444;font-weight:normal;border-right:1px solid #e8e8e8;cursor:pointer;user-select:none}
th:hover{background:#ebedf0}th .sa{font-size:10px;margin-left:4px;color:#aaa}
th:last-child{border-right:none}th:first-child{text-align:center;width:40px}
th:nth-child(3){width:180px}th:nth-child(4){text-align:center;width:50px}th:nth-child(5){width:160px}
td{padding:6px 8px;border-right:1px solid #e8e8e8;border-bottom:1px solid #f0f0f0}
td:last-child{border-right:none}td:first-child{text-align:center}
tr.dr{cursor:pointer}tr.dr:hover{background:#f0f4fa}tr.dr.sel{background:#e3ecf7}
.ph{padding:16px;text-align:center;color:#999}
.al{margin-top:10px;flex-shrink:0}
.al-title{font-size:13px;font-weight:bold;color:#444;margin-bottom:6px}
.at{border:1px solid #d5d5d5;background:#fff;max-height:140px;overflow-y:auto;border-radius:2px}
.at table{width:100%;border-collapse:collapse;font-size:13px}
.at thead tr{background:#f5f6f8;border-bottom:1px solid #d5d5d5}
.at th{padding:5px 8px;text-align:left;color:#444;font-weight:normal;border-right:1px solid #e8e8e8}
.at th:last-child{border-right:none}
.at td{padding:4px 8px;border-right:1px solid #e8e8e8;border-bottom:1px solid #f0f0f0;text-align:left}
.at td:last-child{border-right:none}
.at td:first-child{text-align:center}
.at td input[type=checkbox]{cursor:pointer}
.ac{display:flex;justify-content:flex-end;margin-top:10px;gap:8px;flex-shrink:0}
.ba{background:rgb(24,55,98);border:none;border-radius:2px;font:15px NotoSans,'Malgun Gothic',sans-serif;color:#fff;height:32px;padding:0 20px;cursor:pointer}
.ba:disabled{opacity:.5;cursor:not-allowed}.ba:not(:disabled):hover{background:rgb(34,65,108)}
</style></head><body>
<div class="hdr"><span class="hdr-title">ORCID 논문 검색</span><button class="btn" id="colBtn">접기 ▲</button></div>
<div class="bp" id="bp">
<div class="ir"><label>ORCID iD</label><input type="text" id="oi" placeholder="0000-0000-0000-0000"/><button class="bs" id="sb">검색<span class="tt">마지막으로 검색된 ORCID는 웹 브라우저에 저장됩니다.</span></button><span class="st" id="st"></span></div>
<div class="rc" id="rc"><table><thead><tr><th>선택</th><th data-key="title">논문명</th><th data-key="journal">학술지</th><th data-key="year">연도</th><th data-key="doi">DOI</th></tr></thead><tbody id="tb"><tr><td colspan="5" class="ph">ORCID iD를 입력하고 검색하세요.</td></tr></tbody></table></div>
<div class="al" id="al"><div class="al-title">저자 정보</div><div class="at" id="at"><table><thead><tr><th style="width:40px">순번</th><th>저자명</th><th style="width:60px;text-align:center">주저자</th><th style="width:60px;text-align:center">교신저자</th></tr></thead><tbody id="atb"><tr><td colspan="4" class="ph">논문을 선택하면 저자 목록이 표시됩니다.</td></tr></tbody></table></div></div>
<div class="ac"><button class="ba" id="ab" disabled>자동입력</button></div>
</div>
<script>
(function(){
var oi=document.getElementById('oi'),sb=document.getElementById('sb'),st=document.getElementById('st'),
tb=document.getElementById('tb'),ab=document.getElementById('ab'),cb=document.getElementById('colBtn'),
bp=document.getElementById('bp'),atb=document.getElementById('atb'),sel=null,works=[],authorList=[];
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
// Collapse
var collapsed=false;
cb.onclick=function(){collapsed=!collapsed;bp.style.display=collapsed?'none':'block';cb.textContent=collapsed?'펼치기 ▼':'접기 ▲';window.parent.postMessage({type:'tm-resize',collapsed:collapsed},'*')};
// Load saved ORCID
var saved=localStorage.getItem('tm-orcid-id');if(saved){oi.value=saved}
// Search
sb.onclick=doSearch; oi.onkeydown=function(e){if(e.key==='Enter')doSearch()};
function doSearch(){
 var id=oi.value.trim().replace(/^https?:\\/\\/orcid\\.org\\//,'');
 if(!/^\\d{4}-\\d{4}-\\d{4}-\\d{3}[\\dX]$/.test(id)){st.textContent='올바른 ORCID iD 형식이 아닙니다.';st.style.color='#d32f2f';return}
 st.textContent='검색 중...';st.style.color='#888';sb.disabled=true;
 fetch('https://pub.orcid.org/v3.0/'+id+'/works',{headers:{'Accept':'application/json'}})
 .then(function(r){if(!r.ok)throw new Error(r.status);return r.json()})
 .then(function(d){
  works=[];(d.group||[]).forEach(function(g){
   var s=g['work-summary']&&g['work-summary'][0];if(!s)return;
   var t=s.title&&s.title.title&&s.title.title.value||'(제목 없음)',
       j=s['journal-title']&&s['journal-title'].value||'',
       y=s['publication-date']&&s['publication-date'].year&&s['publication-date'].year.value||'',
       doi='';
   var ei=s['external-ids']&&s['external-ids']['external-id']||[];
   for(var i=0;i<ei.length;i++){if(ei[i]['external-id-type']==='doi'){doi=ei[i]['external-id-value'];break}}
   works.push({title:t,journal:j,year:y,doi:doi,putCode:s['put-code']});
  });
  works.sort(function(a,b){return(b.year||'0')-(a.year||'0')});
  render();st.textContent=works.length+'건 검색됨';st.style.color='#2e7d32';localStorage.setItem('tm-orcid-id',id);
 }).catch(function(e){st.textContent='검색 실패: '+e.message;st.style.color='#d32f2f'})
 .finally(function(){sb.disabled=false});
}
function render(){
 if(!works.length){tb.innerHTML='<tr><td colspan="5" class="ph">검색 결과가 없습니다.</td></tr>';return}
 tb.innerHTML=works.map(function(w,i){
  var ds=w.doi?(w.doi.length>20?w.doi.substring(0,20)+'...':w.doi):'-',
      ts=w.title.length>60?w.title.substring(0,60)+'...':w.title,
      js=w.journal.length>25?w.journal.substring(0,25)+'...':w.journal;
  return '<tr class="dr" data-i="'+i+'"><td><input type="radio" name="ws" value="'+i+'"/></td><td title="'+esc(w.title)+'">'+esc(ts)+'</td><td title="'+esc(w.journal)+'">'+esc(js)+'</td><td>'+esc(w.year)+'</td><td title="'+esc(w.doi)+'">'+esc(ds)+'</td></tr>';
 }).join('');
 tb.querySelectorAll('.dr').forEach(function(r){r.onclick=function(){
  var idx=parseInt(r.dataset.i);sel=works[idx];r.querySelector('input').checked=true;
  tb.querySelectorAll('.dr').forEach(function(x){x.classList.remove('sel')});r.classList.add('sel');
  ab.disabled=false;
  // Fetch authors from Crossref
  authorList=[];
  atb.innerHTML='<tr><td colspan="4" class="ph">저자 정보 로딩 중...</td></tr>';
  if(sel.doi){
   fetch('https://api.crossref.org/works/'+encodeURIComponent(sel.doi))
   .then(function(r){return r.ok?r.json():null})
   .then(function(d){
    if(!d||!d.message||!d.message.author){atb.innerHTML='<tr><td colspan="4" class="ph">저자 정보를 찾을 수 없습니다.</td></tr>';return}
    authorList=d.message.author.map(function(a,i){
     var nm=(a.family||'')+(a.given?' '+a.given:'');
     return{name:nm.trim(),isFirst:a.sequence==='first',isCorre:false};
    });
    renderAuthors();
   }).catch(function(){atb.innerHTML='<tr><td colspan="4" class="ph">저자 정보 로딩 실패</td></tr>'});
  }else{atb.innerHTML='<tr><td colspan="4" class="ph">DOI가 없어 저자 정보를 가져올 수 없습니다.</td></tr>'}
 }});
}
function renderAuthors(){
 if(!authorList.length){atb.innerHTML='<tr><td colspan="4" class="ph">저자 정보가 없습니다.</td></tr>';return}
 atb.innerHTML=authorList.map(function(a,i){
  return '<tr><td style="text-align:center">'+(i+1)+'</td><td>'+esc(a.name)+'</td><td style="text-align:center"><input type="checkbox" data-role="first" data-idx="'+i+'"'+(a.isFirst?' checked':'')+'></td><td style="text-align:center"><input type="checkbox" data-role="corre" data-idx="'+i+'"'+(a.isCorre?' checked':'')+'></td></tr>';
 }).join('');
 atb.querySelectorAll('input[type=checkbox]').forEach(function(cb){cb.onchange=function(){
  var idx=parseInt(cb.dataset.idx),role=cb.dataset.role;
  if(role==='first')authorList[idx].isFirst=cb.checked;
  if(role==='corre')authorList[idx].isCorre=cb.checked;
 }});
}
// Sorting
var sortKey=null,sortAsc=true;
var labels={title:'논문명',journal:'학술지',year:'연도',doi:'DOI'};
document.querySelectorAll('th[data-key]').forEach(function(th){th.onclick=function(){
 var key=th.dataset.key;if(sortKey===key){sortAsc=!sortAsc}else{sortKey=key;sortAsc=true}
 works.sort(function(a,b){var va=(a[key]||'').toLowerCase(),vb=(b[key]||'').toLowerCase();if(va<vb)return sortAsc?-1:1;if(va>vb)return sortAsc?1:-1;return 0});
 sel=null;ab.disabled=true;render();
 document.querySelectorAll('th[data-key] .sa').forEach(function(s){s.remove()});
 var arrow=document.createElement('span');arrow.className='sa';arrow.textContent=sortAsc?'▲':'▼';th.appendChild(arrow);
}});
// Autofill
ab.onclick=function(){if(!sel)return;ab.textContent='처리 중...';ab.disabled=true;
 window.parent.postMessage({type:'tm-autofill',doi:sel.doi,title:sel.title,authors:authorList},'*')};
window.addEventListener('message',function(e){
 if(e.data.type==='tm-done'){ab.textContent='자동입력 완료 ✓';ab.style.background='#2e7d32';setTimeout(function(){ab.textContent='자동입력';ab.style.background='';ab.disabled=false},3000)}
 else if(e.data.type==='tm-err'){ab.textContent='자동입력';ab.disabled=false;st.textContent='실패: '+(e.data.error||'');st.style.color='#d32f2f'}
});
})();
<\/script></body></html>`;
  }

  /* ─── Auto-fill logic (runs in parent context) ─── */
  async function doAutoFill(doi, fallbackTitle, iframeAuthors) {
    const app = nexacro.getApplication();
    const form = app.mainframe.baseFrame.modalPopup.form;
    const ds = form.objects.dsFrutObjtList;

    // If no row exists, add one
    if (ds.rowcount === 0) {
      form.fnRowInsert(); // Nexacro's built-in add-row function
      await new Promise(r => setTimeout(r, 300));
    }
    const row = ds.rowposition;
    if (row < 0) throw new Error('선택된 행이 없습니다. 행추가를 먼저 하세요.');

    // Fetch Crossref
    let cr = null;
    if (doi) {
      const resp = await fetch('https://api.crossref.org/works/' + encodeURIComponent(doi));
      if (resp.ok) cr = (await resp.json()).message;
    }
    if (!cr && fallbackTitle) {
      const resp = await fetch('https://api.crossref.org/works?query.title=' + encodeURIComponent(fallbackTitle) + '&rows=1');
      if (resp.ok) { const j = await resp.json(); cr = j.message?.items?.[0]; }
    }
    if (!cr) throw new Error('Crossref에서 논문 정보를 찾을 수 없습니다.');

    // ── Helpers ──
    function setF(col, val, ctrlPath) {
      if (val == null) return;
      ds.setColumn(row, col, String(val));
      if (ctrlPath) { const c = resolveCtrl(ctrlPath); if (c) c.set_value(String(val)); }
    }
    function resolveCtrl(path) {
      const parts = path.split('.');
      let obj = form;
      for (const p of parts) { obj = obj[p]; if (!obj) return null; if (obj.form) obj = obj.form; }
      return obj;
    }
    function fmtDate(dp) {
      if (!dp?.['date-parts']?.[0]) return '';
      const p = dp['date-parts'][0];
      return String(p[0] || '').padStart(4, '0') + String(p[1] || 1).padStart(2, '0') + String(p[2] || 1).padStart(2, '0');
    }

    // ── Fill fields ──
    const title = cr.title?.[0] || fallbackTitle || '';
    setF('rlngThesNm', title, 'divFrutObjInfo.edtRlngThesNm');
    setF('engThesNm', title, 'divFrutObjInfo.edtEngThesNm');

    setF('jourNm', cr['container-title']?.[0] || '', 'divFrutObjInfo.edtJourNm');

    const doiUrl = cr.DOI ? 'https://doi.org/' + cr.DOI : '';
    setF('doiNo', doiUrl, 'divFrutObjInfo.edtDoiNo');

    setF('issnNo', cr.ISSN?.[0] || '', 'divFrutObjInfo.edtIssnNo');
    setF('isbnNo', cr.ISBN?.[0] || '', 'divFrutObjInfo.edtIsbnNo');

    let vol = cr.volume || '';
    if (cr.issue) vol += '(' + cr.issue + ')';
    setF('publVolNo', vol, 'divFrutObjInfo.edtPublVolNo');

    if (cr.page) {
      const pp = cr.page.split('-');
      const startPg = pp[0]?.trim();
      setF('publStrPgNo', startPg, 'divFrutObjInfo.edtPublStrPgNo');
      setF('publEndPgNo', pp[1]?.trim() || startPg, 'divFrutObjInfo.edtPublEndPgNo');
    } else {
      setF('publStrPgNo', '', 'divFrutObjInfo.edtPublStrPgNo');
      setF('publEndPgNo', '', 'divFrutObjInfo.edtPublEndPgNo');
    }

    const publDe = fmtDate(cr['published-online'] || cr['published']);
    setF('publDe', publDe || '', 'divFrutObjInfo.calPublDe');
    const jourPrssDe = fmtDate(cr['published-print']);
    setF('jourPrssDe', jourPrssDe || '', 'divFrutObjInfo.calJourPrssDe');

    setF('dataSrceSe', 'AM2001'); resolveCtrl('divFrutObjInfo.rdoDataSrceSe')?.set_value('AM2001');

    // ── 발행국가 ──
    // 1. Check manual overrides (ISSN → IRIS code) from GitHub
    // 2. Fallback to OpenAlex (ISO alpha-2 → IRIS code)
    const ISO_TO_IRIS = {"KR":"PH1410","GA":"PH1266","GH":"PH1288","GY":"PH1328","GM":"PH1270","GG":"PH1831","GP":"PH1312","GT":"PH1320","GU":"PH1316","GD":"PH1308","GR":"PH1300","GL":"PH1304","GN":"PH1324","GW":"PH1624","NA":"PH1516","NR":"PH1520","NG":"PH1566","AQ":"PH1010","SS":"PH1728","ZA":"PH1710","NL":"PH1528","AN":"PH1530","NP":"PH1524","NO":"PH1578","NF":"PH1574","NC":"PH1540","NZ":"PH1554","NU":"PH1570","NE":"PH1562","NI":"PH1558","DK":"PH1208","KP":"PH1411","DO":"PH1214","DM":"PH1212","DE":"PH1276","TL":"PH1626","LA":"PH1418","LR":"PH1430","LV":"PH1428","RU":"PH1643","LB":"PH1422","LS":"PH1426","RE":"PH1638","RO":"PH1642","LU":"PH1442","RW":"PH1646","LY":"PH1434","LT":"PH1440","LI":"PH1438","MG":"PH1450","MQ":"PH1474","MH":"PH1584","YT":"PH1175","MO":"PH1446","MW":"PH1454","MY":"PH1458","ML":"PH1466","IM":"PH1833","MX":"PH1484","MC":"PH1492","MA":"PH1504","MU":"PH1480","MR":"PH1478","MZ":"PH1508","ME":"PH1499","MS":"PH1500","MD":"PH1498","MV":"PH1462","MT":"PH1470","MN":"PH1496","US":"PH1840","UM":"PH1581","VI":"PH1850","MM":"PH1104","FM":"PH1583","VU":"PH1548","BH":"PH1048","BB":"PH1052","VA":"PH1336","BS":"PH1044","BD":"PH1050","BM":"PH1060","BJ":"PH1204","VE":"PH1862","VN":"PH1704","BE":"PH1056","BY":"PH1112","BZ":"PH1084","BA":"PH1070","BW":"PH1072","BO":"PH1068","BI":"PH1108","BF":"PH1854","BV":"PH1074","BT":"PH1064","MP":"PH1580","MK":"PH1807","BG":"PH1100","BR":"PH1076","BN":"PH1096","WS":"PH1882","SA":"PH1682","GS":"PH1239","SM":"PH1674","ST":"PH1678","PM":"PH1666","EH":"PH1732","SN":"PH1686","RS":"PH1688","SC":"PH1690","BL":"PH1652","LC":"PH1662","MF":"PH1663","VC":"PH1670","KN":"PH1659","SH":"PH1654","SO":"PH1706","SB":"PH1090","SD":"PH1736","SR":"PH1740","LK":"PH1144","SJ":"PH1744","SE":"PH1752","CH":"PH1756","ES":"PH1724","SK":"PH1703","SI":"PH1705","SY":"PH1760","SL":"PH1694","SG":"PH1702","AE":"PH1784","AW":"PH1533","AM":"PH1051","AR":"PH1032","AS":"PH1016","IS":"PH1352","HT":"PH1332","IE":"PH1372","AZ":"PH1031","AF":"PH1004","AD":"PH1020","AL":"PH1008","DZ":"PH1012","AO":"PH1024","AG":"PH1028","AI":"PH1660","ER":"PH1232","SZ":"PH1748","EE":"PH1233","EC":"PH1218","ET":"PH1231","SV":"PH1222","GB":"PH1826","VG":"PH1092","IO":"PH1086","YE":"PH1887","OM":"PH1512","AU":"PH1036","AT":"PH1040","HN":"PH1340","AX":"PH1248","WF":"PH1876","JO":"PH1400","UG":"PH1800","UY":"PH1858","UZ":"PH1860","UA":"PH1804","IQ":"PH1368","IR":"PH1364","IL":"PH1376","EG":"PH1818","IT":"PH1380","IN":"PH1356","ID":"PH1360","JP":"PH1392","JM":"PH1388","ZM":"PH1894","JE":"PH1832","GQ":"PH1226","GE":"PH1268","CN":"PH1156","CF":"PH1140","DJ":"PH1262","GI":"PH1292","ZW":"PH1716","TD":"PH1148","CZ":"PH1203","CL":"PH1152","CM":"PH1120","CV":"PH1132","KZ":"PH1398","QA":"PH1634","KH":"PH1116","CA":"PH1124","KE":"PH1404","KY":"PH1136","KM":"PH1174","CR":"PH1188","CC":"PH1166","CI":"PH1384","CO":"PH1170","CG":"PH1178","CD":"PH1180","CU":"PH1192","KW":"PH1414","CK":"PH1184","HR":"PH1191","CX":"PH1162","KG":"PH1417","KI":"PH1296","CY":"PH1196","TW":"PH1158","TJ":"PH1762","TZ":"PH1834","TH":"PH1764","TC":"PH1796","TR":"PH1792","TG":"PH1768","TK":"PH1772","TO":"PH1776","TM":"PH1795","TV":"PH1798","TN":"PH1788","TT":"PH1780","PA":"PH1591","PY":"PH1600","PK":"PH1586","PG":"PH1598","PW":"PH1585","PS":"PH1275","FO":"PH1234","PE":"PH1604","PT":"PH1620","FK":"PH1238","PL":"PH1616","PR":"PH1630","FR":"PH1250","GF":"PH1254","TF":"PH1260","PF":"PH1258","FJ":"PH1242","FI":"PH1246","PH":"PH1608","PN":"PH1612","HM":"PH1334","HU":"PH1348","HK":"PH1344","XK":"PH1383","CW":"PH1531","SX":"PH1534"};
    const OVERRIDES_URL = 'https://raw.githubusercontent.com/pjb7687/better-iris/main/journal-country-overrides.json';
    const allIssns = cr.ISSN || [];
    let irisNatCode = '';

    // Step 1: Check manual overrides
    if (allIssns.length) {
      try {
        const ovResp = await fetch(OVERRIDES_URL, { cache: 'no-cache' });
        if (ovResp.ok) {
          const overrides = await ovResp.json();
          for (const issn of allIssns) {
            if (overrides[issn]) { irisNatCode = overrides[issn]; break; }
          }
        }
      } catch (_) {}
    }

    // Step 2: Fallback to OpenAlex
    if (!irisNatCode && allIssns.length) {
      try {
        const oaJourResp = await fetch('https://api.openalex.org/sources/issn:' + encodeURIComponent(allIssns[0]));
        if (oaJourResp.ok) {
          const oaJour = await oaJourResp.json();
          const cc = oaJour.country_code;
          if (cc) irisNatCode = ISO_TO_IRIS[cc.toUpperCase()] || '';
        }
      } catch (_) {}
    }
    setF('issuNatSe', irisNatCode, 'divFrutObjInfo.cboIssuNatSe');

    function cleanAbstract(raw) {
      return (raw || '')
        .replace(/<\/?(jats:)?p>/gi, '\n')
        .replace(/<\/?(jats:)?(sec|title)>/gi, '\n')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/^\s*Abstract\s*/i, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();
    }

    let abs = cleanAbstract(cr.abstract);

    // Fallback: try OpenAlex and Semantic Scholar if Crossref has no abstract
    if (!abs && cr.DOI) {
      // OpenAlex: returns abstract as inverted index, reconstruct it
      try {
        const oaResp = await fetch('https://api.openalex.org/works/doi:' + encodeURIComponent(cr.DOI));
        if (oaResp.ok) {
          const oa = await oaResp.json();
          if (oa.abstract_inverted_index) {
            const words = [];
            for (const [word, positions] of Object.entries(oa.abstract_inverted_index)) {
              for (const pos of positions) words[pos] = word;
            }
            abs = words.join(' ').trim();
          }
        }
      } catch (_) {}
    }
    if (!abs && cr.DOI) {
      // Semantic Scholar
      try {
        const s2Resp = await fetch('https://api.semanticscholar.org/graph/v1/paper/DOI:' + encodeURIComponent(cr.DOI) + '?fields=abstract');
        if (s2Resp.ok) {
          const s2 = await s2Resp.json();
          if (s2.abstract) abs = s2.abstract.trim();
        }
      } catch (_) {}
    }
    if (!abs && cr.DOI) {
      // Europe PMC (for biomedical papers)
      try {
        const pmcResp = await fetch('https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:' + encodeURIComponent(cr.DOI) + '&format=json&resultType=core');
        if (pmcResp.ok) {
          const pmc = await pmcResp.json();
          const hit = pmc.resultList?.result?.[0];
          if (hit?.abstractText) abs = cleanAbstract(hit.abstractText);
        }
      } catch (_) {}
    }

    setF('thesAbstCn', abs || '', 'divFrutObjInfo.txtThesAbstCn');

    // ── Authors (from iframe author table with user-selected roles) ──
    const ia = iframeAuthors || [];
    const firstAuthors = ia.filter(a => a.isFirst).map(a => a.name);
    const correAuthors = ia.filter(a => a.isCorre).map(a => a.name);
    const coAuthors = ia.filter(a => !a.isFirst).map(a => a.name);

    const pf = form.tabFrutObjt?.TabpageDetail?.form?.divPernOrgn?.form;
    if (pf) {
      setF('mauthrNm', firstAuthors.join(';')); setF('mauthrCnt', String(firstAuthors.length)); pf.edtMauthrNm?.set_value(firstAuthors.join(';')); pf.edtMauthrCnt?.set_value(String(firstAuthors.length));
      setF('jontAuthrNmLst', coAuthors.join(';')); setF('jontAuthrCnt', String(coAuthors.length)); pf.edtJontAuthrNmLst?.set_value(coAuthors.join(';')); pf.edtJontAuthrCnt?.set_value(String(coAuthors.length));
      setF('cmctAuthrNmLst', correAuthors.join(';')); setF('cmctAuthrCnt', String(correAuthors.length)); pf.edtCmctAuthrNmLst?.set_value(correAuthors.join(';')); pf.edtCmctAuthrCnt?.set_value(String(correAuthors.length));
      const pub = cr.publisher || '';
      setF('issuaNm', pub); pf.edtIssuaNm?.set_value(pub);
      setF('sumCnt', String(ia.length)); pf.edtSumCnt?.set_value(String(ia.length));
    }

    // ── 기타정보 ──
    const ef = form.tabFrutObjt?.TabpageEtc?.form?.divSumn?.form;
    const countries = new Set();
    (cr.author || []).forEach(a => (a.affiliation || []).forEach(af => {
      const n = (af.name || '').toLowerCase();
      if (n.includes('korea') || n.includes('한국')) countries.add('KR');
      else if (n) countries.add('X');
    }));
    const intl = countries.size > 1 ? 'Y' : 'N';
    setF('intnJontRschThesYn', intl); ef?.rdoIntnJontRschThesYn?.set_value(intl);

    setF('thesKwdCn', abs || ''); ef?.txtThesKwdCn?.set_value(abs || '');

  }

  /* ─── Inject section ─── */
  function inject() {
    const ic = getInnerContainer();
    if (!ic || ic.querySelector('.tm-orcid-section')) return; // already injected

    let sectionHeight = SECTION_HEIGHT_EXP;

    // Add CSS override for Nexacro's position:absolute on all divs
    if (!document.getElementById('tm-orcid-styles')) {
      const style = document.createElement('style');
      style.id = 'tm-orcid-styles';
      style.textContent = `
        .tm-orcid-section, .tm-orcid-section * {
          position: static !important;
          overflow: visible !important;
          white-space: normal !important;
        }
        .tm-orcid-section {
          position: absolute !important;
          overflow: visible !important;
        }
        .tm-orcid-section iframe {
          display: block !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Shift elements below insertion point using CSS transform
    Array.from(ic.children).forEach(ch => {
      const top = parseInt(ch.style.top) || 0;
      if (top >= SECTION_TOP) {
        ch.style.transform = `translateY(${sectionHeight}px)`;
        ch.classList.add('tm-orcid-shifted');
      }
    });
    ic.style.height = (ORIGINAL_FORM_HEIGHT + sectionHeight) + 'px';

    // Create section
    const sec = document.createElement('div');
    sec.className = 'tm-orcid-section';
    sec.style.cssText = `top:${SECTION_TOP}px; left:24px; width:1056px; z-index:10;`;

    const ifr = document.createElement('iframe');
    ifr.id = 'tm-orcid-iframe';
    ifr.style.cssText = `border:none !important; width:1056px !important; height:${IFRAME_HEIGHT_EXP}px !important; background:transparent !important;`;
    sec.appendChild(ifr);
    ic.appendChild(sec);

    // Write iframe content
    const iDoc = ifr.contentDocument || ifr.contentWindow.document;
    iDoc.open(); iDoc.write(buildIframeHTML()); iDoc.close();

    // ── Full scroll takeover ──
    // Disable Nexacro's scroll entirely, handle everything ourselves.
    const SCROLL_MAX = ORIGINAL_FORM_HEIGHT + sectionHeight - 788; // 1645+380-788 = 1237
    const STEP = 80;
    let scrollPos = 0; // our tracked scroll position (0 to SCROLL_MAX)
    let form = null;

    try {
      const app = nexacro.getApplication();
      form = app.mainframe.baseFrame.modalPopup.form;

      // Read current scroll position
      scrollPos = Math.abs(parseInt(ic.style.top)) || 0;

      // Kill Nexacro's _scrollTo so it can never set ic.style.top
      window.__tmOrigScrollTo = form._scrollTo;
      form._scrollTo = function () { /* noop */ };

      // Extend scrollbar max so thumb range covers 0-1237
      const vsb = form.vscrollbar;
      if (vsb) {
        const origSetScrollInfo = vsb._setScrollInfo.bind(vsb);
        window.__tmOrigSetScrollInfo = origSetScrollInfo;
        vsb._setScrollInfo = function (l, t, w, h, si_min, si_max, si_line, si_page, si_view, si_enable, si_pos) {
          if (ic.querySelector('.tm-orcid-section')) {
            si_max += sectionHeight;
          }
          return origSetScrollInfo(l, t, w, h, si_min, si_max, si_line, si_page, si_view, si_enable, si_pos);
        };
      }
      form._onResetScrollBar();
    } catch (err) {
      console.warn('[Better IRIS] Scroll takeover failed:', err);
    }

    function syncScroll() {
      ic.style.top = -scrollPos + 'px';
      if (form) form._vscroll_pos = scrollPos;
      if (form && form.vscrollbar) {
        form.vscrollbar._pos = scrollPos;
        form.vscrollbar.pos = scrollPos;
        const rc = form.vscrollbar._rectshaft;
        if (rc) form.vscrollbar._resetTrackBar(rc.left, rc.top, rc.left + rc.width, rc.top + rc.height);
      }
    }

    function doScroll(deltaY) {
      const delta = deltaY > 0 ? STEP : -STEP;
      scrollPos = Math.max(0, Math.min(SCROLL_MAX, scrollPos + delta));
      syncScroll();
    }

    // Forward wheel events from iframe to parent scroll,
    // but let scrollable containers (.rc, .at) scroll internally first
    iDoc.addEventListener('wheel', function (e) {
      var scrollables = ['rc', 'at'];
      for (var si = 0; si < scrollables.length; si++) {
        var el = iDoc.getElementById(scrollables[si]);
        if (el && el.contains(e.target)) {
          var atTop = el.scrollTop <= 0;
          var atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
          if (!(e.deltaY < 0 && atTop) && !(e.deltaY > 0 && atBottom)) {
            return; // let inner container scroll naturally
          }
        }
      }
      e.preventDefault();
      doScroll(e.deltaY);
    }, { passive: false });

    // Single wheel handler for the entire 0-1237 range
    const modalEl = document.querySelector('#mainframe\\.baseFrame\\.modalPopup');
    function onWheel(e) {
      if (!modalEl) return;
      const rect = modalEl.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right ||
          e.clientY < rect.top || e.clientY > rect.bottom) return;

      // Check scrollable children (grid, textarea, select list)
      let target = e.target;
      while (target && target !== modalEl) {
        if (target.scrollHeight > target.clientHeight + 1) {
          const style = getComputedStyle(target);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            const atTop = target.scrollTop <= 0;
            const atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 1;
            if (!(e.deltaY < 0 && atTop) && !(e.deltaY > 0 && atBottom)) {
              return; // let child scroll
            }
          }
        }
        target = target.parentElement;
      }

      e.preventDefault();
      doScroll(e.deltaY);
    }
    modalEl.addEventListener('wheel', onWheel, { capture: true, passive: false });
    window.__tmWheelHandler = onWheel;
    window.__tmWheelModal = modalEl;

    // ── Parent message handler ──
    function onMsg(e) {
      if (e.data.type === 'tm-resize') {
        const col = e.data.collapsed;
        const newH = col ? SECTION_HEIGHT_COL : SECTION_HEIGHT_EXP;
        ifr.style.setProperty('height', (col ? IFRAME_HEIGHT_COL : IFRAME_HEIGHT_EXP) + 'px', 'important');
        document.querySelectorAll('.tm-orcid-shifted').forEach(el => {
          el.style.transform = `translateY(${newH}px)`;
        });
        const curIc = getInnerContainer();
        if (curIc) curIc.style.height = (ORIGINAL_FORM_HEIGHT + newH) + 'px';
        sectionHeight = newH;
      }
      if (e.data.type === 'tm-autofill') {
        doAutoFill(e.data.doi, e.data.title, e.data.authors)
          .then(() => ifr.contentWindow.postMessage({ type: 'tm-done' }, '*'))
          .catch(err => ifr.contentWindow.postMessage({ type: 'tm-err', error: err.message }, '*'));
      }
    }
    window.addEventListener('message', onMsg);
  }

  /* ─── Cleanup on modal close ─── */
  function cleanup() {
    if (window.__tmWheelHandler && window.__tmWheelModal) {
      window.__tmWheelModal.removeEventListener('wheel', window.__tmWheelHandler, { capture: true });
      delete window.__tmWheelHandler;
      delete window.__tmWheelModal;
    }
    try {
      const app = nexacro.getApplication();
      const form = app.mainframe.baseFrame.modalPopup.form;
      if (window.__tmOrigScrollTo) form._scrollTo = window.__tmOrigScrollTo;
      if (window.__tmOrigSetScrollInfo && form.vscrollbar) {
        form.vscrollbar._setScrollInfo = window.__tmOrigSetScrollInfo;
      }
    } catch (_) {}
    delete window.__tmOrigScrollTo;
    delete window.__tmOrigSetScrollInfo;

    document.querySelectorAll('.tm-orcid-section').forEach(el => el.remove());
    document.querySelectorAll('.tm-orcid-shifted').forEach(el => {
      el.style.transform = '';
      el.classList.remove('tm-orcid-shifted');
    });
    const ic = getInnerContainer();
    if (ic) ic.style.height = ORIGINAL_FORM_HEIGHT + 'px';
  }

  /* ─── MutationObserver: watch for modal ─── */
  let modalWasOpen = false;
  const observer = new MutationObserver(() => {
    const modal = document.querySelector('#mainframe\\.baseFrame\\.modalPopup');
    if (modal) {
      modalWasOpen = true;
      // Check if it's the 논문 modal (FRUTTHES0001_P01)
      const form = modal.querySelector('[id*="FRUTTHES0001"]');
      const btnCnlk = modal.querySelector('[id*="btnCnlkSrch"]');
      if (btnCnlk && !modal.querySelector('.tm-orcid-section')) {
        setTimeout(inject, 500); // wait for Nexacro to finish rendering
      }
    } else if (modalWasOpen) {
      modalWasOpen = false;
      cleanup();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Also try injecting now if modal is already open
  setTimeout(inject, 1000);

})();
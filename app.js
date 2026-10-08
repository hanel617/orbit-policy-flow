const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const projects = [
  {id:'human-agent', name:'Human & Agent 프로젝트', short:'Human & Agent', initial:'H', goal:'Human–AI 협업 플랫폼 만들기', description:'사람과 AI Agent가 함께 일하는 프로젝트 운영 시스템', due:'2026. 10. 30'},
  {id:'client', name:'고객사 A 서비스 구축', short:'고객사 A 구축', initial:'A', goal:'고객사 A의 서비스 MVP 출시', description:'고객사의 신규 디지털 서비스 MVP 제작', due:'2026. 11. 13'},
  {id:'content', name:'콘텐츠 스튜디오', short:'콘텐츠 스튜디오', initial:'C', goal:'콘텐츠 제작 워크플로우 구축', description:'콘텐츠 기획·제작·배포 프로세스 설계', due:'2026. 11. 06'}
];
const initialStreams = [
  {id:'product', name:'제품기획', owner:'김철수', type:'Human', initials:'CS', color:'mint', mark:'P', description:'요구사항을 정리하고 제품 구조와 명세를 설계합니다. 검토한 결과는 프로젝트 전체평가로 전달됩니다.', steps:[
    {name:'요구정리', status:'complete', description:'사용자 요구와 기존 자료를 분석해 제품의 핵심 요구사항을 정리합니다.', output:'요구사항 정리 문서'},
    {name:'구조설계', status:'complete', description:'요구사항을 기반으로 정보 구조와 기능 간의 관계를 설계합니다.', output:'제품 구조 설계안'},
    {name:'명세작성', status:'review', description:'기능의 동작, 예외 상황과 인수 기준을 작성하고 담당자에게 검토를 요청합니다.', output:'제품 기능 명세 v0.3'},
    {name:'평가요청', status:'waiting', description:'승인된 기획 산출물을 제출하고 전체 프로젝트 평가를 요청합니다.', output:'제품기획 평가 요청'}
  ]},
  {id:'design', name:'UI / UX 디자인', owner:'Gemini', type:'Agent', initials:'GE', color:'purple', mark:'D', description:'제품 요구사항을 화면 구조와 사용자 경험으로 구체화합니다. 주요 디자인 결과는 사람이 검토합니다.', steps:[
    {name:'리서치', status:'complete', description:'사용자 경험의 문제와 참고 사례를 조사합니다.', output:'UX 리서치 요약'},
    {name:'화면설계', status:'complete', description:'주요 사용자 시나리오와 화면별 정보 구조를 설계합니다.', output:'와이어프레임 v0.2'},
    {name:'디자인', status:'running', description:'화면 설계에 맞춰 컴포넌트와 인터페이스 시안을 만듭니다.', output:'UI 디자인 시안'},
    {name:'평가요청', status:'waiting', description:'디자인 시안과 검증 결과를 프로젝트 평가로 전달합니다.', output:'디자인 평가 요청'}
  ]},
  {id:'dev', name:'Full stack 개발', owner:'Claude', type:'Agent', initials:'CL', color:'cyan', mark:'E', description:'설계와 명세를 기반으로 기능을 구현하고 검증합니다. 중요한 코드와 배포는 담당자가 최종 승인합니다.', steps:[
    {name:'환경구축', status:'complete', description:'저장소, 개발 환경과 테스트 실행 기반을 준비합니다.', output:'개발 환경 설정'},
    {name:'기능개발', status:'complete', description:'명세를 기준으로 사용자 기능과 데이터 흐름을 구현합니다.', output:'기능 구현 코드'},
    {name:'테스트', status:'complete', description:'핵심 사용자 흐름과 예외 동작을 테스트합니다.', output:'테스트 결과 보고서'},
    {name:'평가요청', status:'running', description:'구현 코드와 테스트 결과를 제출하고 전체평가를 요청합니다.', output:'개발 평가 요청'}
  ]}
];
const statusLabels = {complete:'완료', running:'진행 중', review:'검토 대기', waiting:'예정'};
const statusColors = {complete:'mint', running:'purple', review:'amber', waiting:'neutral'};
const storageKey = 'orbit-policy-prototype-v1';
let stored = {};
try { stored = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch {}
let currentProject = projects.some(p => p.id === stored.projectId) ? stored.projectId : 'human-agent';
let selected = {stream:'product', step:null};
let filter = 'all';
let editMode = false;
let zoom = 1, translateX = 0, translateY = 0;
let toastTimeout;
const stateByProject = {};
function state() {
  if (!stateByProject[currentProject]) {
    const saved = stored.states?.[currentProject];
    const streams = structuredClone(initialStreams);
    if (saved?.streams) streams.forEach(stream => {
      const prior = saved.streams.find(s => s.id === stream.id);
      if (!prior) return;
      stream.owner = typeof prior.owner === 'string' ? prior.owner.slice(0, 40) : stream.owner;
      stream.steps.forEach((step,index) => {
        const priorStep = prior.steps?.[index];
        if (priorStep && statusLabels[priorStep.status]) step.status = priorStep.status;
        if (typeof priorStep?.name === 'string' && priorStep.name.trim()) step.name = priorStep.name.slice(0,20);
      });
    });
    stateByProject[currentProject] = {
      streams,
      goal: typeof saved?.goal === 'string' && saved.goal.trim() ? saved.goal.slice(0,100) : project().goal,
      interval: ['5','15','30','60'].includes(saved?.interval) ? saved.interval : '15',
      humanApproval: typeof saved?.humanApproval === 'boolean' ? saved.humanApproval : true,
      activities: Array.isArray(saved?.activities) ? saved.activities.slice(0,3).map(a=>({text:String(a.text).slice(0,120),sub:String(a.sub).slice(0,80)})) : [],
      policyVersion: Number.isInteger(saved?.policyVersion) ? Math.min(saved.policyVersion,999) : 0
    };
  }
  return stateByProject[currentProject];
}
function project() { return projects.find(p => p.id === currentProject); }
function persist() {
  stored = {projectId:currentProject, states:{...stored.states, ...stateByProject}};
  try { localStorage.setItem(storageKey, JSON.stringify(stored)); return true; }
  catch { toast('브라우저 저장을 사용할 수 없어 이번 세션에만 반영됩니다.'); return false; }
}
function toast(message) {
  clearTimeout(toastTimeout); $('#toast').textContent = message; $('#toast').classList.add('visible');
  toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 3500);
}
function showModal(title, body) {
  $('#modal-title').textContent = title; $('#modal-body').innerHTML = body;
  if (!$('#modal').open) $('#modal').showModal();
}
function closeModal() { $('#modal').close(); }
$('#close-modal').addEventListener('click', closeModal);
$('#modal').addEventListener('click', event => { if (event.target === $('#modal')) { const rect = $('#modal').getBoundingClientRect(); if (event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom) closeModal(); } });
function renderStreams() {
  $('#stream-list').innerHTML = state().streams.map(stream => `<article class="stream-card ${selected.stream===stream.id?'selected':''} ${filter!=='all'&&filter!==stream.id?'dimmed':''}" data-stream="${stream.id}"><div class="stream-heading"><button class="stream-name" data-stream-select="${stream.id}"><span class="${stream.color}-icon">${stream.mark}</span>${escapeHTML(stream.name)}</button><span class="stream-owner">${icon(stream.type==='Human'?'people':'agent')}${escapeHTML(stream.owner)}<span class="owner-type">${stream.type.toUpperCase()}</span></span></div><div class="steps">${stream.steps.map((step,index)=>`<button class="step ${step.status} ${selected.stream===stream.id&&selected.step===index?'selected':''}" data-step="${stream.id}:${index}" aria-label="${escapeHTML(stream.name)} · ${escapeHTML(step.name)} · ${statusLabels[step.status]}"><span class="step-circle">${step.status==='complete'?icon('check'):step.status==='review'?icon('clock'):step.status==='running'?'':String(index+1).padStart(2,'0')}</span><span>${escapeHTML(step.name)}</span></button>`).join('')}</div></article>`).join('');
  $$('[data-stream-select]').forEach(button=>button.addEventListener('click',()=>selectStream(button.dataset.streamSelect)));
  $$('[data-step]').forEach(button=>button.addEventListener('click',()=>{const [stream,index]=button.dataset.step.split(':');selectStream(stream,Number(index));}));
}
function selectStream(stream, step = null) {
  selected = {stream, step}; editMode = false; showInspector(); renderStreams(); renderInspector();
  $$('[data-select]').forEach(node=>node.classList.remove('selected'));
}
function showInspector() { $('#inspector').classList.remove('closed'); $('#inspector').classList.add('open'); }
function renderInspector() {
  if (editMode) { renderEditor(); return; }
  if (selected.node) { renderNodeInspector(selected.node); return; }
  const stream = state().streams.find(s=>s.id===selected.stream);
  if (!stream) return;
  const step = selected.step===null?null:stream.steps[selected.step];
  const done = stream.steps.filter(s=>s.status==='complete').length;
  const current = step || stream.steps.find(s=>s.status!=='complete') || stream.steps.at(-1);
  const badge = statusColors[current.status];
  $('#inspector-content').innerHTML = `<div class="inspector-eyebrow"><span class="status-dot"></span>${step?'WORK STEP':'EXECUTION STREAM'}</div><div class="inspector-title"><span class="node-icon ${stream.color}-icon">${icon(stream.type==='Human'?'people':'agent')}</span><h2>${escapeHTML(step?.name||stream.name)}</h2></div><p class="inspector-description">${escapeHTML(step?.description||stream.description)}</p><div class="detail-tags"><span class="badge ${badge}">${statusLabels[current.status]}</span><span class="badge neutral">${step?escapeHTML(stream.name):'병렬 실행'}</span></div><div class="inspector-section"><h3>담당자<button class="text-button" id="edit-owner">변경 ${icon('edit')}</button></h3><div class="owner-box"><span class="avatar">${stream.initials}</span><div><strong>${escapeHTML(stream.owner)}</strong><small>${stream.type==='Human'?'제품 책임자 · Human':'실행 에이전트 · AI'}</small></div><span class="badge ${stream.type==='Human'?'neutral':'purple'}">${stream.type}</span></div><div class="detail-row"><span>실행 방식</span><strong>${stream.type==='Human'?'사람 중심 · AI 지원':'Agent 실행 · Human 검토'}</strong></div><div class="detail-row"><span>목표 일정</span><strong>${project().due}</strong></div></div><div class="inspector-section"><h3>업무 Flow <span class="subtle-label">${done} / 4 완료</span></h3><div class="detail-progress"><span>Stream 진행</span><strong>${done*25}%</strong></div><div class="progress-bar"><span style="width:${done*25}%"></span></div><div class="detail-stage-list">${stream.steps.map((s,index)=>`<button class="detail-stage ${s.status} ${s===current?'current':''}" data-detail-step="${index}"><span class="stage-number">${s.status==='complete'?icon('check'):String(index+1).padStart(2,'0')}</span>${escapeHTML(s.name)}<span class="badge ${statusColors[s.status]}">${statusLabels[s.status]}</span></button>`).join('')}</div>${current.status==='review'?`<div class="callout"><strong>${icon('clock')}담당자의 검토를 기다리고 있어요</strong>${escapeHTML(stream.owner)}님의 승인 후 다음 단계로 이어집니다.</div><button class="button primary full" id="approve-step">${icon('check')}검토 후 승인하기</button>`:''}<button class="button secondary full" id="execution-details">업무 실행 Flow 보기 ${icon('arrow')}</button></div><div class="inspector-section"><h3>연결된 산출물 <span class="subtle-label">${current.status==='waiting'?'예정':'샘플'}</span></h3><button class="deliverable full" id="open-deliverable">${icon('plan')}<div><strong>${escapeHTML(current.output)}</strong><small>업무 결과 · 상세 미리보기</small></div>${icon('chevron')}</button></div><p class="inspector-note">${icon('flow')}업무 흐름은 여기서, Agent·Tool·API의 실행 세부는 업무 실행 Flow에서 확인합니다.</p>`;
  $$('[data-detail-step]').forEach(button=>button.addEventListener('click',()=>selectStream(stream.id,Number(button.dataset.detailStep))));
  $('#edit-owner').addEventListener('click',()=>{editMode=true;renderEditor();});
  $('#execution-details').addEventListener('click',()=>showExecution(stream,step));
  $('#open-deliverable').addEventListener('click',()=>showModal(current.output,`<p class="modal-description">테스트용 산출물 미리보기입니다. 실제 파일과는 연결되지 않았습니다.</p><div class="resource-item">${icon('plan')}<div><strong>${escapeHTML(current.output)}</strong><small>${escapeHTML(stream.name)} / ${escapeHTML(current.name)}</small></div><span class="badge ${statusColors[current.status]}">${statusLabels[current.status]}</span></div><p class="modal-description">${escapeHTML(current.description)}</p><div class="modal-foot">담당: ${escapeHTML(stream.owner)} · 완료 기준: 결과 작성, 담당자 확인, 다음 단계에 전달</div>`));
  $('#approve-step')?.addEventListener('click',()=>approve(stream.id,stream.steps.indexOf(current)));
}
function approve(streamId,index) {
  const stream=state().streams.find(s=>s.id===streamId); const step=stream.steps[index];
  if (step.status!=='review') return;
  step.status='complete'; if (stream.steps[index+1]?.status==='waiting') stream.steps[index+1].status='running';
  state().activities.unshift({text:`${stream.name} · ${step.name} 검토가 승인되었습니다`,sub:`${stream.owner} · 다음 단계 실행 가능`});
  state().activities=state().activities.slice(0,3); const saved=persist(); renderAll();
  toast(saved?'샘플 검토가 승인되었습니다. 다음 업무 단계가 시작됩니다.':'샘플 검토가 승인되었습니다. 이번 세션에 반영됩니다.');
}
function renderNodeInspector(node) {
  const details={
    goal:{title:'프로젝트 목표',kicker:'PROJECT GOAL',symbol:'target',color:'mint',description:'프로젝트 전체가 같은 방향으로 움직이도록 목표와 성공 기준을 정의합니다.',rows:[['프로젝트',project().short],['목표 일정',project().due],['성공 기준','핵심 협업 Flow 검증']],content:`<div class="callout" style="border-color:#2a5145;background:#152c25;color:#9cc3b3"><strong style="color:#b2e4cf">${escapeHTML(state().goal)}</strong>${escapeHTML(project().description)}</div>`},
    plan:{title:'계획 · 운영 정책',kicker:'PLAN & POLICY',symbol:'plan',color:'purple',description:'목표를 실행 가능한 업무로 나누고, 역할과 승인 기준을 설정합니다.',rows:[['실행 Stream','3개'],['상태 수집',`${state().interval}분마다`],['최종 산출물',state().humanApproval?'Human 승인 필수':'Stream 자체 확인']],content:'<p class="inspector-description">제품기획 → UI/UX → 개발의 업무 의존성을 확인하고, 병렬로 가능한 단계는 함께 실행합니다.</p>'},
    collect:{title:'요청 · 상태수집',kicker:'STATUS COLLECTION',symbol:'collect',color:'cyan',description:'각 Stream의 업무 상태와 산출물을 수집하고 평가에 필요한 정보를 정리합니다.',rows:[['수집 대상','전체 3개 Stream'],['수집 주기',`${state().interval}분`],['수집 항목','진행 · 산출물 · 요청']],content:'<div class="callout"><strong>평가 요청을 모으는 단계</strong>Stream에서 평가요청이 도착하면 진행 상태와 산출물을 함께 취합합니다.</div>'},
    evaluate:{title:'프로젝트 전체평가',kicker:'PROJECT EVALUATION',symbol:'eval',color:'purple',description:'각 업무의 결과를 프로젝트 목표와 연결해 전체 진행도와 리스크를 평가합니다.',rows:[['평가 기준','목표 · 품질 · 일정'],['실행 조건','전체 결과 수집 완료'],['현재 상태','수집 완료 대기']],content:'<p class="inspector-description">개별 업무의 완료 여부를 넘어, 프로젝트가 목표를 달성할 수 있는지 종합적으로 확인합니다.</p>'},
    decision:{title:'의사결정',kicker:'HUMAN DECISION',symbol:'branch',color:'amber',description:'평가 결과를 바탕으로 다음 실행 방향을 결정합니다. 조정이 필요하면 계획 단계로 돌아갑니다.',rows:[['담당','프로젝트 관리자'],['실행 조건','프로젝트 전체평가 완료'],['가능한 결정','승인 · 수정 · 재계획']],content:'<div class="callout"><strong>피드백이 다음 계획으로 이어져요</strong>목표 미달이나 리스크가 발견되면 역할, 일정 또는 업무 범위를 다시 조정합니다.</div>'}
  };
  const d=details[node];
  $('#inspector-content').innerHTML=`<div class="inspector-eyebrow"><span class="status-dot"></span>${d.kicker}</div><div class="inspector-title"><span class="node-icon ${d.color}-icon">${icon(d.symbol)}</span><h2>${d.title}</h2></div><p class="inspector-description">${d.description}</p><div class="detail-tags"><span class="badge neutral">운영 블록</span><span class="badge ${d.color==='cyan'?'mint':d.color}">${['goal','plan','collect'].includes(node)?'적용 중':'예정'}</span></div><div class="inspector-section"><h3>운영 정보</h3>${d.rows.map(([label,value])=>`<div class="detail-row"><span>${label}</span><strong>${escapeHTML(value)}</strong></div>`).join('')}</div><div class="inspector-section"><h3>정책 상세</h3>${d.content}<button class="button secondary full" id="edit-node">${icon('edit')}운영 정책 수정</button></div><p class="inspector-note">${icon('flow')}이 화면은 업무 의미 단위의 운영 흐름을 보여줍니다. 각 단계의 기술적 실행은 하위 Flow에서 확인합니다.</p>`;
  $('#edit-node').addEventListener('click',()=>{editMode=true;renderEditor();});
}
function renderEditor() {
  const stream=state().streams.find(s=>s.id===selected.stream);
  const step=stream&&selected.step!==null?stream.steps[selected.step]:null;
  $('#inspector-content').innerHTML=`<div class="inspector-eyebrow">POLICY EDITOR</div><div class="inspector-title"><span class="node-icon purple-icon">${icon('edit')}</span><h2>정책 편집</h2></div><p class="inspector-description">프로젝트 운영 기준을 조정하세요. 변경사항은 이 브라우저에 저장됩니다.</p><form id="policy-form"><label class="form-field">프로젝트 목표<textarea name="goal" maxlength="100" required>${escapeHTML(state().goal)}</textarea></label><label class="form-field">상태 수집 주기<select name="interval">${['5','15','30','60'].map(i=>`<option value="${i}" ${state().interval===i?'selected':''}>${i}분마다</option>`).join('')}</select></label><label class="form-checkbox"><input type="checkbox" name="humanApproval" ${state().humanApproval?'checked':''}>최종 산출물은 Human 승인 후 전달</label>${stream?`<div class="inspector-section"><h3>${escapeHTML(stream.name)} 설정</h3><label class="form-field">${stream.type==='Human'?'담당자':'담당 Agent'}<input name="owner" value="${escapeHTML(stream.owner)}" maxlength="40" required></label>${step?`<label class="form-field">업무 단계 이름<input name="stepName" value="${escapeHTML(step.name)}" maxlength="20" required></label><label class="form-field">단계 상태<select name="stepStatus">${Object.entries(statusLabels).map(([value,label])=>`<option value="${value}" ${step.status===value?'selected':''}>${label}</option>`).join('')}</select></label>`:''}</div>`:''}<div class="form-actions"><button class="button primary" type="submit">${icon('save')}변경사항 저장</button><button class="button secondary" type="button" id="cancel-edit">취소</button></div></form><button class="reset-button" id="reset-project">이 프로젝트의 샘플 데이터 초기화</button>`;
  $('#cancel-edit').addEventListener('click',()=>{editMode=false;renderInspector();});
  $('#policy-form').addEventListener('submit',event=>{
    event.preventDefault(); const form=new FormData(event.target);const goal=String(form.get('goal')).trim();const owner=stream?String(form.get('owner')).trim():'';const stepName=step?String(form.get('stepName')).trim():'';
    if(!goal||(stream&&!owner)||(step&&!stepName)){toast('이름과 목표는 빈칸으로 저장할 수 없습니다.');return;}
    state().goal=goal; state().interval=String(form.get('interval')); state().humanApproval=form.has('humanApproval');
    if(stream)stream.owner=owner;
    if(step){step.name=stepName;step.status=String(form.get('stepStatus'));}
    state().policyVersion+=1;state().activities.unshift({text:'프로젝트 운영 정책이 변경되었습니다',sub:`Daniel Kim · v1.${state().policyVersion}`});state().activities=state().activities.slice(0,3);
    const saved=persist();editMode=false;renderAll();toast(saved?'운영 정책을 저장했습니다. 이 브라우저에서 유지됩니다.':'운영 정책을 이번 세션에 적용했습니다.');
  });
  $('#reset-project').addEventListener('click',()=>{showModal('샘플 데이터 초기화',`<p class="modal-description">현재 프로젝트의 수정한 정책과 샘플 승인 기록을 초기화합니다.</p><div class="form-actions"><button class="button primary" id="confirm-reset">초기화하기</button><button class="button secondary" id="cancel-reset">취소</button></div>`);$('#cancel-reset').addEventListener('click',closeModal);$('#confirm-reset').addEventListener('click',()=>{delete stateByProject[currentProject];if(stored.states)delete stored.states[currentProject];state();persist();editMode=false;selected={stream:'product',step:null};closeModal();renderAll();toast('현재 프로젝트의 샘플 데이터를 초기화했습니다.');});});
}
function showExecution(stream = state().streams[0],step = null) {
  const active=step||stream.steps.find(s=>s.status!=='complete')||stream.steps[0];
  const sequences=stream.id==='product'?[['기존 문서 조회','Tool · 프로젝트 자료 검색','Tool'],['프로젝트 맥락 조회','Data · 목표와 이전 의사결정 확인','Data'],['Planner Agent 분석','Agent · 요구사항 분석과 초안 생성','Agent'],['담당자 검토',`Human · ${stream.owner} 검토 및 수정`,'Human'],['결과 문서 저장','Tool · 승인된 결과를 산출물로 저장','Tool']]:stream.id==='design'?[['요구사항 불러오기','Data · 제품기획 산출물 확인','Data'],['참고 자료 검색','Tool · UI 및 UX 사례 분석','Tool'],['디자인 Agent 실행',`Agent · ${stream.owner} 화면 초안 작성`,'Agent'],['Human 디자인 검토','Human · 사용성과 일관성 확인','Human'],['디자인 결과 저장','Tool · 승인된 시안 저장','Tool']]:[['명세와 코드 조회','Data · 최신 명세와 저장소 확인','Data'],['개발 Agent 실행',`Agent · ${stream.owner} 코드 구현`,'Agent'],['테스트 실행','Tool · 핵심 동작 및 오류 검증','Tool'],['Human 코드 검토','Human · 구현 품질과 위험 확인','Human'],['결과 제출','Tool · 코드와 테스트 결과 전달','Tool']];
  showModal(`${stream.name} / ${active.name}`,`<p class="modal-description">상위 업무 단계를 구성하는 실행 Flow 예시입니다. 실제 Agent나 API를 실행하지 않는 테스트 화면입니다.</p>${sequences.map(([title,description,type],i)=>`${i?'<div class="execution-arrow">↓</div>':''}<div class="execution-step"><span>${String(i+1).padStart(2,'0')}</span><div><strong>${escapeHTML(title)}</strong><small>${escapeHTML(description)}</small></div><span class="badge ${type==='Human'?'amber':type==='Agent'?'purple':'mint'}">${type}</span></div>`).join('')}<div class="modal-foot">상위 화면에서는 업무 의미를, 이 화면에서는 Human · Agent · Tool · Data의 실행 관계를 확인합니다.</div>`);
}
function renderMetrics() {
  const steps=state().streams.flatMap(s=>s.steps);const done=steps.filter(s=>s.status==='complete').length;const reviews=steps.filter(s=>s.status==='review').length;
  $('.metrics article:nth-child(2) .metric-value').innerHTML=`${Math.round(done/steps.length*100)}<span class="unit">%</span><span class="metric-spark">▁▂▃▃▅▆</span>`;
  $('.metrics article:nth-child(2) .metric-foot').textContent=`전체 ${steps.length}개 단계 중 ${done}개 완료`;
  $('#approval-count').innerHTML=`${String(reviews).padStart(2,'0')}<span class="metric-tag ${reviews?'amber':'mint'}">${reviews?'확인 필요':'검토 완료'}</span>`;
  const reviewing=state().streams.find(s=>s.steps.some(step=>step.status==='review'));
  $('#approval-summary').textContent=reviewing?`${reviewing.name} · ${reviewing.steps.find(s=>s.status==='review').name} 검토`:'대기 중인 승인 요청이 없습니다';
  $('#collection-label').textContent=`${state().interval}분마다 모든 Stream 상태를 확인해요`;
  $('.policy-row .badge').textContent=state().humanApproval?'승인 필수':'자체 확인';
  $('.policy-row div>span').textContent=state().humanApproval?'최종 산출물은 담당자의 승인을 거쳐요':'최종 산출물은 각 Stream에서 자체 확인해요';
  $('.version-label').textContent=`v1.${state().policyVersion}`;
}
function renderActivity() {
  const activities=[...state().activities.map(a=>({...a,color:'purple',symbol:'check',time:'방금'})),{text:'Claude가 테스트 결과를 제출했습니다',sub:'Full stack 개발 · 평가요청',color:'mint',symbol:'agent',time:'2분 전'},{text:'김철수님에게 명세 검토를 요청했습니다',sub:'제품기획 · 명세작성',color:'amber',symbol:'clock',time:'12분 전'},{text:'Gemini가 화면 설계를 완료했습니다',sub:'UI / UX 디자인 · 화면설계',color:'purple',symbol:'agent',time:'28분 전'}].slice(0,3);
  $('#activity-list').innerHTML=activities.map(a=>`<div class="activity-row"><span class="activity-symbol ${a.color}-icon">${icon(a.symbol)}</span><div><strong>${escapeHTML(a.text)}</strong><small>${escapeHTML(a.sub)}</small></div><span>${a.time}</span></div>`).join('');
}
function renderAll() {
  $('#project-short').textContent=project().short;$('#project-crumb').textContent=project().name;$('.project-avatar').textContent=project().initial;
  $('#goal-caption').textContent=state().goal; renderStreams();renderMetrics();renderActivity();renderInspector();
}
function projectPicker() {
  showModal('프로젝트 선택',`<p class="modal-description">같은 운영 구조를 사용하는 3개의 샘플 프로젝트입니다. 정책과 검토 기록은 프로젝트별로 저장됩니다.</p>${projects.map(p=>`<button class="modal-project ${p.id===currentProject?'selected':''}" data-project="${p.id}"><span class="project-avatar">${p.initial}</span><div><strong>${p.name}</strong><small>${p.description}</small></div>${icon(p.id===currentProject?'check':'chevron')}</button>`).join('')}`);
  $$('[data-project]').forEach(button=>button.addEventListener('click',()=>{currentProject=button.dataset.project;selected={stream:'product',step:null};editMode=false;filter='all';$('#stream-filter').value='all';persist();renderAll();closeModal();toast(`${project().name}로 전환했습니다.`);}));
}
function showGuide() {
  showModal('정책 관리 Flow 사용 가이드',`<p class="modal-description">업무의 흐름은 한눈에, 실행의 세부는 한 단계 깊게.</p><ol class="guide-list"><li>왼쪽 프로젝트 선택에서 운영할 프로젝트를 고르세요.</li><li>캔버스의 운영 블록이나 Stream 안의 업무 단계를 클릭하세요. 오른쪽에 담당자, 상태와 산출물이 표시됩니다.</li><li>업무 실행 Flow 보기에서 Human · Agent · Tool의 하위 실행 순서를 확인하세요.</li><li>정책 편집에서 목표, 수집 주기, 담당자와 단계 상태를 변경하세요.</li><li>확대·축소 버튼과 캔버스 드래그로 흐름을 탐색하세요.</li></ol><div class="modal-foot">샘플 데이터 기반 프로토타입입니다. 정책 수정은 이 브라우저에 저장되며 실제 Agent 실행이나 다중 사용자 동기화는 포함하지 않습니다.</div>`);
}
function showNotifications() {
  const reviewing=state().streams.find(s=>s.steps.some(step=>step.status==='review'));
  showModal('알림',reviewing?`<div class="notification-item"><span class="badge amber">검토 대기</span><p>${escapeHTML(reviewing.owner)}님에게 ${escapeHTML(reviewing.name)}의 ${escapeHTML(reviewing.steps.find(s=>s.status==='review').name)} 검토가 요청되었습니다.</p><small>샘플 알림 · 업무 Flow에서 확인할 수 있어요</small><button class="button secondary" id="notification-open">요청 확인 ${icon('arrow')}</button></div>`:'<p class="modal-description">확인이 필요한 샘플 승인 요청이 없습니다.</p>');
  $('#notification-open')?.addEventListener('click',()=>{selectStream(reviewing.id,reviewing.steps.findIndex(s=>s.status==='review'));closeModal();});
}
function showResource(nav) {
  if(nav==='연동 도구')showModal(nav,`<p class="modal-description">실행 Flow에서 사용할 연동 도구 예시입니다. 실제 연결은 하지 않은 샘플 목록입니다.</p>${[['folder','프로젝트 문서','요구사항과 산출물 저장'],['branch','Git 저장소','개발 소스와 변경 이력'],['agent','AI 모델','Gemini · Claude']].map(([symbol,title,description])=>`<div class="resource-item"><span class="node-icon purple-icon">${icon(symbol)}</span><div><strong>${title}</strong><small>${description}</small></div><span class="badge neutral">샘플</span></div>`).join('')}`);
  if(nav==='인원 관리')showModal(nav,`<p class="modal-description">프로젝트의 Stream에 할당된 담당자와 에이전트입니다.</p>${state().streams.map(s=>`<div class="resource-item"><span class="node-icon ${s.color}-icon">${icon(s.type==='Human'?'people':'agent')}</span><div><strong>${escapeHTML(s.owner)}</strong><small>${s.name}</small></div><span class="badge ${s.type==='Human'?'neutral':'purple'}">${s.type}</span></div>`).join('')}`);
  if(nav==='대시보드')showModal('프로젝트 운영 요약',`<p class="modal-description">${escapeHTML(project().name)}</p><div class="resource-item"><span class="node-icon mint-icon">${icon('target')}</span><div><strong>${escapeHTML(state().goal)}</strong><small>목표 일정 ${project().due}</small></div></div><div class="resource-item"><span class="node-icon purple-icon">${icon('flow')}</span><div><strong>3개의 실행 Stream</strong><small>제품기획 · UI/UX 디자인 · Full stack 개발</small></div><span class="badge mint">운영 중</span></div><div class="modal-foot">이 프로토타입은 정책 관리 Flow를 중심으로 구현되었습니다. 프로젝트 운영 대시보드는 현재 요약 미리보기입니다.</div>`);
}
$$('[data-nav]').forEach(button=>button.addEventListener('click',()=>{
  const nav=button.dataset.nav;
  if(nav==='정책 관리 Flow'){selected={stream:'product',step:null};editMode=false;renderAll();return;}
  if(nav==='프로젝트 리스트'){projectPicker();return;}
  if(nav==='업무 실행 Flow'){showExecution(state().streams.find(s=>s.id===selected.stream)||state().streams[0]);return;}
  if(nav==='설정'){selected={node:'plan'};editMode=true;showInspector();renderEditor();return;}
  showResource(nav);
}));
$('#project-switch').addEventListener('click',projectPicker);
$('.brand').addEventListener('click',event=>{event.preventDefault();showGuide();});
$('#help-button').addEventListener('click',showGuide);$('#flow-more').addEventListener('click',showGuide);
$('#notifications').addEventListener('click',showNotifications);
$('#edit-policy').addEventListener('click',()=>{editMode=true;showInspector();renderEditor();});
$('#open-policies').addEventListener('click',()=>{selected={node:'plan'};editMode=true;showInspector();renderStreams();renderEditor();});
$('#close-inspector').addEventListener('click',()=>{$('#inspector').classList.add('closed');$('#inspector').classList.remove('open');requestAnimationFrame(fitView);});
$$('[data-select]').forEach(button=>button.addEventListener('click',()=>{selected={node:button.dataset.select};editMode=false;showInspector();renderStreams();renderInspector();$$('[data-select]').forEach(n=>n.classList.toggle('selected',n===button));}));
$('#stream-filter').addEventListener('change',event=>{filter=event.target.value;if(filter!=='all')selectStream(filter);else renderStreams();});
function applyTransform() { $('#canvas-graph').style.transform=`translate(${translateX}px, ${translateY}px) scale(${zoom})`;$('#zoom-label').textContent=`${Math.round(zoom*100)}%`; }
function fitView() {
  const view=$('#canvas-viewport'); const mobile=window.innerWidth<700;
  zoom=mobile?.6:Math.min((view.clientWidth-32)/1040,(view.clientHeight-65)/480,1.1);
  translateX=mobile?view.clientWidth/2-583*zoom:(view.clientWidth-1040*zoom)/2;
  translateY=(view.clientHeight-480*zoom)/2-10;
  applyTransform();
}
function changeZoom(multiplier) {
  const view=$('#canvas-viewport');const next=Math.max(.25,Math.min(1.6,zoom*multiplier));const cx=view.clientWidth/2;const cy=view.clientHeight/2;
  translateX=cx-(cx-translateX)*next/zoom;translateY=cy-(cy-translateY)*next/zoom;zoom=next;applyTransform();
}
$('#zoom-in').addEventListener('click',()=>changeZoom(1.2));$('#zoom-out').addEventListener('click',()=>changeZoom(1/1.2));$('#fit-view').addEventListener('click',fitView);
let pan;
$('#canvas-viewport').addEventListener('pointerdown',event=>{
  if(event.button!==0||event.target.closest('button,select,.stream-card,.flow-node'))return;
  pan={x:event.clientX,y:event.clientY,tx:translateX,ty:translateY};$('#canvas-viewport').setPointerCapture(event.pointerId);$('#canvas-viewport').style.cursor='grabbing';
});
$('#canvas-viewport').addEventListener('pointermove',event=>{if(!pan)return;translateX=pan.tx+event.clientX-pan.x;translateY=pan.ty+event.clientY-pan.y;applyTransform();});
function stopPan(){pan=null;$('#canvas-viewport').style.cursor='';}
$('#canvas-viewport').addEventListener('pointerup',stopPan);$('#canvas-viewport').addEventListener('pointercancel',stopPan);
let lastWidth=0;new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(Math.abs(width-lastWidth)>2){lastWidth=width;fitView();}}).observe($('#canvas-viewport'));
renderAll();requestAnimationFrame(fitView);

const CSS = String.raw`
:root{
  color-scheme:dark;
  --bg:oklch(0.19 0.006 95);--paper:oklch(0.225 0.007 95);--paper-2:oklch(0.27 0.008 95);
  --ink:oklch(0.98 0.004 95);--fg:oklch(0.91 0.01 95);--muted:oklch(0.77 0.008 95);
  --line:oklch(0.38 0.008 95);--line-strong:oklch(0.55 0.01 95);
  --coral:oklch(0.72 0.14 40);--coral-btn:oklch(0.74 0.14 40);--coral-ink:oklch(0.82 0.11 40);--on-coral:oklch(0.16 0.01 40);
  --green:oklch(0.72 0.12 155);--green-ink:oklch(0.8 0.1 155);
  --amber:oklch(0.8 0.15 85);--amber-ink:oklch(0.85 0.1 85);--red:oklch(0.7 0.17 25);
  --font:"Inter",ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
  --radius:8px;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 var(--font);font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
a{color:inherit}
button,input{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--coral);outline-offset:2px}
[hidden]{display:none!important}
input::placeholder{color:var(--muted);opacity:1}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.wrap{max-width:1180px;margin:0 auto;padding:28px 20px 64px}

/* masthead */
.top{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-bottom:28px}
.brand{font-weight:700;font-size:15px;letter-spacing:-.01em;color:var(--ink);text-decoration:none}
.brand span{color:var(--muted);font-weight:500}
.links{display:flex;gap:8px}
.masthead{padding-bottom:28px}
.kicker{margin:0 0 8px;font:600 11px/1.2 var(--font);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.kicker .accent{color:var(--coral-ink)}
h1{margin:0;font-size:clamp(32px,4.4vw,48px);line-height:1.05;letter-spacing:-.03em;font-weight:600;color:var(--ink);text-wrap:balance}
.lede{margin:12px 0 0;max-width:58ch;font-size:16px;line-height:1.5}

/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 14px;border-radius:var(--radius);border:1px solid var(--line-strong);background:var(--paper);cursor:pointer;font-size:13px;font-weight:600;color:var(--ink);text-decoration:none;white-space:nowrap}
.btn:hover{border-color:var(--fg)}
.btn.primary{background:var(--coral-btn);border-color:var(--coral-btn);color:var(--on-coral)}
.btn.primary:hover{filter:brightness(.95)}
.btn.danger{color:var(--red)}
.btn.danger:hover{border-color:var(--red)}
.btn:disabled{opacity:.6;cursor:not-allowed;filter:none;border-color:var(--line-strong)}
.btn.sm{padding:6px 10px;font-size:13px}
.lnk{border:0;background:none;padding:0;font-size:13px;color:var(--muted);cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.lnk:hover{color:var(--ink)}
.lnk:disabled{opacity:.6;cursor:not-allowed}

/* layout */
.layout{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:16px;align-items:start}
.col>*+*{margin-top:16px}
.panel{background:var(--paper);border:1px solid var(--line);border-radius:12px;min-width:0}
.panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--line)}
.panel-head h2{margin:0;font-size:15px;font-weight:600;color:var(--ink)}
.panel-body{padding:20px}
.label{font-size:12.5px;font-weight:600;color:var(--muted)}
.note{font-size:13px;color:var(--muted);margin:0}

/* pills */
.pill{display:inline-flex;align-items:center;gap:6px;border-radius:6px;border:1px solid transparent;padding:1px 8px;font:500 12px/1.5 var(--font);white-space:nowrap}
.pill.gray{background:var(--paper-2);color:var(--fg);border-color:var(--line)}
.pill.coral{background:color-mix(in oklab,var(--coral) 14%,var(--paper));color:var(--coral-ink);border-color:color-mix(in oklab,var(--coral) 40%,var(--paper))}

/* boarding pass */
.ticket{overflow:hidden}
.trip{display:grid;gap:10px;padding:16px 20px;background:color-mix(in oklab,var(--paper-2) 45%,var(--paper));border-bottom:1px solid var(--line)}
.trip-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.trip-row input{flex:1 1 180px;min-width:0;padding:7px 10px;border:1px solid var(--line-strong);border-radius:var(--radius);background:var(--paper);font:13px/1.4 var(--mono);color:var(--ink)}
.trip-row .or{font-size:13px;color:var(--muted);padding:0 4px}
.trip-meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:13px;color:var(--muted)}
.pass{padding:22px 20px 20px}
.pass-meta{display:flex;justify-content:space-between;gap:12px;font-size:13px;color:var(--muted)}
.pass-meta b{color:var(--ink);font-weight:600}
.route{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:16px;margin:18px 0 20px}
.iata{font-size:52px;line-height:1;font-weight:600;letter-spacing:-.04em;color:var(--ink)}
.city{margin-top:6px;font-size:13px;color:var(--muted)}
.route>div:last-child{text-align:right}
.arc{display:block;width:100%;height:56px;overflow:visible}
.arc path{fill:none;stroke:var(--line-strong);stroke-width:1.5;stroke-dasharray:3 5}
.path{position:relative;min-width:0}
.plane{position:absolute;left:50%;top:6px;width:22px;height:22px;margin-left:-11px;transform:rotate(90deg);fill:var(--coral);transition:fill .3s,opacity .3s}
.ticket[data-status="idle"] .plane{fill:var(--line-strong)}
.ticket[data-status="delayed"] .plane{fill:var(--amber)}
.ticket[data-status="cancelled"] .plane{fill:var(--red);opacity:.6}
.ticket[data-status="cancelled"] .arc path{stroke:color-mix(in oklab,var(--red) 50%,var(--line))}
.status{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--radius);font-size:14px;border:1px solid var(--line);background:var(--paper-2);color:var(--fg)}
.status strong{display:inline-flex;align-items:center;gap:8px;font-weight:600}
.status .dot{width:8px;height:8px;border-radius:50%;background:currentColor}
.status.idle{color:var(--muted)}
.status.idle .dot{background:transparent;border:1.5px solid currentColor}
.status.on_time{background:color-mix(in oklab,var(--green) 14%,var(--paper));border-color:color-mix(in oklab,var(--green) 40%,var(--paper));color:var(--green-ink)}
.status.delayed{background:color-mix(in oklab,var(--amber) 20%,var(--paper));border-color:color-mix(in oklab,var(--amber) 50%,var(--paper));color:var(--amber-ink)}
.status.cancelled{background:color-mix(in oklab,var(--red) 12%,var(--paper));border-color:color-mix(in oklab,var(--red) 40%,var(--paper));color:var(--red)}
#delay{font-weight:600}
.times{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}
.times>div:last-child{text-align:right}
.time{font-size:28px;font-weight:600;letter-spacing:-.02em;color:var(--ink);line-height:1.2}
.old{display:block;font-size:13px;color:var(--muted);text-decoration:line-through;min-height:1.2em}
.zone{font-size:12.5px;color:var(--muted)}
.ticket[data-status="cancelled"] .time{color:var(--muted);text-decoration:line-through}
.perf{position:relative;border-top:1.5px dashed var(--line-strong)}
.perf::before,.perf::after{content:"";position:absolute;top:-10px;width:18px;height:18px;border-radius:50%;background:var(--bg);border:1px solid var(--line)}
.perf::before{left:-10px}.perf::after{right:-10px}
.controls{padding:18px 20px 20px}
.controls h3{margin:0;font-size:14px;font-weight:600;color:var(--ink)}
.controls .note{margin:2px 0 12px}
.actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.actions .lnk{margin-left:auto}
#publish-status{margin-top:12px;font-size:13px;color:var(--muted)}
#publish-status.ok{color:var(--green-ink)}
.error{margin:0 20px 20px;padding:8px 12px;border-radius:var(--radius);font-size:13px;color:var(--red);background:color-mix(in oklab,var(--red) 10%,var(--paper));border:1px solid color-mix(in oklab,var(--red) 35%,var(--paper))}

/* activity */
.activity ol{list-style:none;margin:0;padding:0}
.activity li{display:grid;grid-template-columns:12px 84px minmax(0,1fr);gap:10px;align-items:baseline;padding:9px 0;border-top:1px solid var(--line);font-size:13.5px;color:var(--ink)}
.activity li:first-child{border-top:0;padding-top:0}
.activity li i{width:8px;height:8px;border-radius:50%;background:var(--line-strong);align-self:center}
.activity li.k-on_time i{background:var(--green)}
.activity li.k-delayed i{background:var(--amber)}
.activity li.k-cancelled i{background:var(--red)}
.activity li.k-trip i{background:var(--coral)}
.activity time{font-size:13px;color:var(--muted)}
.activity .empty{display:block;color:var(--muted);font-size:13.5px}

/* steps */
.steps{list-style:none;margin:0;padding:0}
.step{display:grid;grid-template-columns:28px minmax(0,1fr);gap:14px;padding:20px;border-top:1px solid var(--line)}
.step:first-child{border-top:0}
.num{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;border:1px solid var(--line-strong);font-size:13px;font-weight:600;color:var(--ink);background:var(--paper)}
.step.done .num{background:var(--green-ink);border-color:var(--green-ink);color:var(--on-coral)}
.step h3{margin:3px 0 4px;font-size:15px;font-weight:600;color:var(--ink)}
.step p{margin:0 0 12px;font-size:13.5px}
.field{display:flex;gap:6px}
.field input{flex:1;min-width:0;padding:8px 10px;border:1px solid var(--line-strong);border-radius:var(--radius);background:var(--bg);font:13px/1.4 var(--mono);color:var(--ink)}
.prompt{margin:0 0 10px;padding:12px 14px;border-left:2px solid var(--coral);border-radius:0 var(--radius) var(--radius) 0;background:var(--bg);font-size:14.5px;line-height:1.5;color:var(--ink)}
.step code,.setup code{font:12.5px var(--mono);background:var(--paper-2);border:1px solid var(--line);padding:0 4px;border-radius:4px;color:var(--ink)}
.setup{border-top:1px solid var(--line);padding:14px 20px;font-size:13.5px}
.setup summary{cursor:pointer;font-weight:600;color:var(--ink);font-size:13.5px}
.setup summary::marker{color:var(--muted)}
.setup p{margin:8px 0 0;color:var(--fg)}

footer{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:32px;padding-top:16px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}

@media (max-width:880px){
  .layout{grid-template-columns:minmax(0,1fr)}
  .howto{order:-1}
}
@media (max-width:520px){
  .wrap{padding:20px 16px 48px}
  .top{padding-bottom:20px}
  .links .btn:first-child{display:none}
  .iata{font-size:40px}
  .time{font-size:22px}
  .actions .lnk{margin-left:0;flex-basis:100%;text-align:left}
  .trip-row input{flex-basis:100%}
  .trip-row .btn{flex:1}
  .trip-row .or{display:none}
}
@media (prefers-reduced-motion:reduce){.plane{transition:none}}
`;

const BODY = String.raw`
<div class="wrap">
<header class="top">
  <a class="brand" href="/">MCPJam <span>/ Flights</span></a>
  <nav class="links" aria-label="External">
    <a class="btn sm" href="https://github.com/MCPJam/mcp-flights-demo">View source</a>
    <a class="btn sm primary" href="https://app.mcpjam.com" target="_blank" rel="noopener">Open MCPJam ↗</a>
  </nav>
</header>

<section class="masthead">
  <p class="kicker"><span class="accent">MCP Events</span> · MCP Apps · Live demo</p>
  <h1>Delay a flight here, and your agent tells you.</h1>
  <p class="lede">Give your agent a fictional flight and connect its status event in MCPJam. When you delay or cancel the flight on this page, MCPJam receives the event and your agent replies. No account or token is needed.</p>
</section>

<div class="layout">
<div class="col">
  <section class="panel ticket" id="ticket" data-status="idle" aria-label="Flight simulator">
    <div class="panel-head"><h2>Your flight</h2><span class="pill gray">Simulated trip</span></div>
    <div class="trip">
      <label class="label" for="trip-id">Demo trip</label>
      <div class="trip-row">
        <input id="trip-id" placeholder="Paste your agent’s trip ID" autocomplete="off" spellcheck="false">
        <button id="load-trip" class="btn">Load</button>
        <span class="or">or</span>
        <button id="create" class="btn primary">Create trip</button>
      </div>
      <div class="trip-meta"><span id="trip-hint">Use the trip ID from your agent so you both control the same flight.</span><span id="expires"></span></div>
    </div>
    <div class="pass">
      <div class="pass-meta"><span><b>MCPJam Airways</b> · MJ204</span><span id="date">Tomorrow</span></div>
      <div class="route">
        <div><div class="iata">SFO</div><div class="city">San Francisco</div></div>
        <div class="path" aria-hidden="true">
          <svg class="arc" viewBox="0 0 200 56" preserveAspectRatio="none"><path vector-effect="non-scaling-stroke" d="M4 50 Q100 -10 196 50"/></svg>
          <svg class="plane" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>
        </div>
        <div><div class="iata">JFK</div><div class="city">New York</div></div>
      </div>
      <div id="flight-status" class="status idle" role="status" aria-live="polite">
        <strong><span class="dot"></span><span id="flight-status-text">No trip loaded</span></strong><span id="delay"></span>
      </div>
      <div class="times">
        <div><div class="label">Departs</div><span id="departure" class="time">—</span><span id="old-departure" class="old"></span><div class="zone">San Francisco time</div></div>
        <div><div class="label">Arrives</div><span id="arrival" class="time">—</span><span id="old-arrival" class="old"></span><div class="zone">New York time</div></div>
      </div>
    </div>
    <div class="perf" aria-hidden="true"></div>
    <div class="controls">
      <h3>Change the flight</h3>
      <p class="note">Each change publishes a <code>flight.status_changed</code> event for this trip.</p>
      <div class="actions">
        <button class="btn" data-status="delayed" data-delay="45" disabled>Delay 45 min</button>
        <button class="btn" data-status="delayed" data-delay="180" disabled>Delay 3 hours</button>
        <button class="btn danger" data-status="cancelled" disabled>Cancel flight</button>
        <button class="lnk" data-status="on_time" disabled>Reset to on time</button>
      </div>
      <p id="publish-status" role="status" aria-live="polite">Load or create a trip to turn these on.</p>
    </div>
    <p id="error" class="error" role="alert" hidden></p>
  </section>

  <section class="panel activity" aria-labelledby="activity-h">
    <div class="panel-head"><h2 id="activity-h">Trip activity</h2><span class="note">Last 8 changes</span></div>
    <div class="panel-body"><ol id="activity"><li class="empty">Changes you make appear here.</li></ol></div>
  </section>
</div>

<section class="panel howto" aria-labelledby="how-h">
  <div class="panel-head"><h2 id="how-h">Run the demo</h2></div>
  <ol class="steps">
    <li class="step" id="step-1"><span class="num">1</span><div>
      <h3>Connect the server</h3>
      <p>In MCPJam, add an HTTP server with this URL and set Authentication to <b>None</b>.</p>
      <div class="field"><input id="url" readonly aria-label="Server URL"><button class="btn" data-copy="url">Copy</button></div>
    </div></li>
    <li class="step" id="step-2"><span class="num">2</span><div>
      <h3>Ask your agent for a trip</h3>
      <blockquote id="prompt" class="prompt">Create a demo trip and let me know if my flight is cancelled or delayed.</blockquote>
      <p>Your agent calls <code>create_demo_trip</code>, shows the flight card and gives you a trip ID. MCPJam gives the agent no tool for subscribing, so it asks you to connect the event.</p>
      <button id="copy-prompt" class="btn">Copy prompt</button>
    </div></li>
    <li class="step" id="step-3"><span class="num">3</span><div>
      <h3>Connect the event in MCPJam</h3>
      <p>In the Playground, open <b>Events → Connect event</b>. Choose <code>flight.status_changed</code>, enter the trip ID and <code>MJ204</code>, and add an instruction for your agent:</p>
      <blockquote id="instruction" class="prompt">Let me know if MJ204 is cancelled or delayed. Include the new departure time for delays. Don’t simulate changes.</blockquote>
      <button id="copy-instruction" class="btn">Copy instruction</button>
    </div></li>
    <li class="step" id="step-4"><span class="num">4</span><div>
      <h3>Change the flight</h3>
      <p>Paste the trip ID into <b>Demo trip</b> and press a change button, or ask your agent to “simulate a 45-minute delay for my trip.” Then check MCPJam for the event and your agent’s reply.</p>
    </div></li>
  </ol>
  <details class="setup"><summary>Try rebooking</summary>
    <p>Add “If it’s delayed 3 hours or more, rebook me.” to the instruction, then press <b>Delay 3 hours</b>. Your agent calls <code>rebook_flight</code>, which moves the trip to MJ208, the next fictional flight on the route, and shows its card. The ticket on this page keeps showing MJ204.</p>
  </details>
  <details class="setup"><summary>About trip IDs</summary>
    <p>A trip ID keeps one visitor’s fictional data apart from another’s. Anyone with the ID can view the trip and change it. Trips expire after 30 minutes, and creating or viewing one does not connect the event. Don’t enter real passenger information.</p>
  </details>
</section>
</div>

<footer><span>Flights, trips and rebookings are fictional, and nothing is purchased.</span><span>Official TypeScript SDK · Experimental Events extension</span></footer>
<p id="copy-status" class="sr" role="status"></p>
</div>
`;

const SCRIPT = String.raw`
const $=id=>document.getElementById(id);let current,busy=false,activityStarted=false;const key='mcpjam-anonymous-flight-trip';
$('url').value=new URL('/mcp',location.href).href;
const fmt=(iso,zone)=>iso?new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit',timeZone:zone}).format(new Date(iso)):'—';
const showError=m=>{$('error').textContent=m;$('error').hidden=false;};
function enable(on){document.querySelectorAll('[data-status]').forEach(b=>b.disabled=!on);}
function record(text,kind){if(!activityStarted){$('activity').replaceChildren();activityStarted=true;}const row=document.createElement('li'),dot=document.createElement('i'),time=document.createElement('time'),msg=document.createElement('span');row.className='k-'+(kind||'trip');time.textContent=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'});msg.textContent=text;row.append(dot,time,msg);$('activity').prepend(row);while($('activity').children.length>8)$('activity').lastChild.remove();}
function renderFlight(f){$('ticket').dataset.status=f.status;$('date').textContent=new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',timeZone:f.originTimeZone}).format(new Date(f.scheduledDeparture));$('flight-status').className='status '+f.status;$('flight-status-text').textContent={on_time:'On time',delayed:'Delayed',cancelled:'Cancelled'}[f.status];$('delay').textContent=f.status==='delayed'?'+'+f.delayMinutes+' min':'';$('departure').textContent=fmt(f.estimatedDeparture,f.originTimeZone);$('arrival').textContent=fmt(f.estimatedArrival,f.destinationTimeZone);$('old-departure').textContent=f.status==='delayed'?fmt(f.scheduledDeparture,f.originTimeZone):'';$('old-arrival').textContent=f.status==='delayed'?fmt(f.scheduledArrival,f.destinationTimeZone):'';}
function setLive(on){$('create').classList.toggle('primary',!on);$('trip-hint').textContent=on?'Give this trip ID to your agent, or load the one it created.':'Use the trip ID from your agent so you both control the same flight.';}
function checkExpiry(){if(current&&current.expiresAt<=Date.now()){enable(false);setLive(false);$('expires').textContent='Trip expired. Create or load a new one.';return true;}return false;}
async function api(method='GET',data){if(!current||checkExpiry())throw Error('Create or load a trip to continue.');const endpoint='/demo/flight'+(method==='GET'?'?tripId='+encodeURIComponent(current.tripId):'');const response=await fetch(endpoint,{method,headers:{'Content-Type':'application/json'},...(data?{body:JSON.stringify({tripId:current.tripId,...data})}:{})});if(!response.ok){const err=Error(await response.text());err.status=response.status;throw err;}return response.json();}
function forgetTrip(message){current=undefined;try{sessionStorage.removeItem(key);}catch{}enable(false);setLive(false);$('trip-id').value='';$('expires').textContent='';$('ticket').dataset.status='idle';$('flight-status').className='status idle';$('flight-status-text').textContent='No trip loaded';['delay','old-departure','old-arrival'].forEach(id=>$(id).textContent='');$('departure').textContent='—';$('arrival').textContent='—';$('publish-status').className='';$('publish-status').textContent=message;}
function saveTrip(s){current=s;$('trip-id').value=s.tripId;$('expires').textContent='Expires '+new Date(s.expiresAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});enable(true);setLive(true);$('publish-status').className='';$('publish-status').textContent='Ready. Connect the event for this trip ID in MCPJam before you change the flight.';try{sessionStorage.setItem(key,JSON.stringify(s));}catch{}}
async function refresh(){if(!current||busy||document.hidden||checkExpiry())return;try{const result=await api();renderFlight(result.flights.find(f=>f.flightId==='MJ204'));$('error').hidden=true;}catch(e){if(e.status===404){forgetTrip('That trip has expired. Create or load a new one.');$('error').hidden=true;}else showError(e.message);}}
async function loadTrip(){const id=$('trip-id').value.trim();if(busy)return;if(!id){showError('Paste a trip ID first, or create a new trip.');$('trip-id').focus();return;}busy=true;try{const response=await fetch('/demo/flight?tripId='+encodeURIComponent(id));if(!response.ok)throw Error(await response.text());const s=await response.json();saveTrip({tripId:s.tripId,expiresAt:s.expiresAt});renderFlight(s.flights.find(f=>f.flightId==='MJ204'));record('Trip loaded.','trip');$('error').hidden=true;}catch(e){showError(e.message);}finally{busy=false;}}
$('load-trip').onclick=loadTrip;$('trip-id').onkeydown=e=>{if(e.key==='Enter')loadTrip();};
$('create').onclick=async()=>{if(busy)return;busy=true;$('create').disabled=true;enable(false);$('error').hidden=true;try{const response=await fetch('/trips',{method:'POST'});if(!response.ok)throw Error(await response.text());const s=await response.json();saveTrip(s);renderFlight(s.flight);activityStarted=false;record('Trip created. Give this trip ID to your agent.','trip');}catch(e){showError(e.message);}finally{busy=false;$('create').disabled=false;enable(!!current&&!checkExpiry());}};
document.querySelectorAll('[data-status]').forEach(button=>button.onclick=async()=>{if(busy)return;busy=true;enable(false);$('create').disabled=true;try{const data={flightId:'MJ204',status:button.dataset.status};if(button.dataset.delay)data.delayMinutes=Number(button.dataset.delay);const result=await api('POST',data);renderFlight(result.flight);const f=result.flight;const description=f.status==='delayed'?'Delayed '+f.delayMinutes+' minutes.':f.status==='cancelled'?'Flight cancelled.':'Back on time.';$('publish-status').className=result.emitted?'ok':'';$('publish-status').textContent=result.emitted?'Event published. Check MCPJam for the event and your agent’s reply.':'No change, so no duplicate event was published.';if(result.emitted){record(description,f.status);$('step-4').classList.add('done');}$('error').hidden=true;}catch(e){showError(e.message);}finally{busy=false;$('create').disabled=false;enable(!!current&&!checkExpiry());}});
async function copy(text,btn){const label=btn.textContent;try{await navigator.clipboard.writeText(text);btn.textContent='Copied';$('copy-status').textContent='Copied to clipboard.';}catch{btn.textContent='Copy failed';$('copy-status').textContent='Clipboard unavailable. Select the text and copy it yourself.';}setTimeout(()=>{btn.textContent=label;},1600);}
document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{copy($(b.dataset.copy).value,b);$('step-1').classList.add('done');});
$('copy-prompt').onclick=()=>{copy($('prompt').textContent,$('copy-prompt'));$('step-2').classList.add('done');};
$('copy-instruction').onclick=()=>{copy($('instruction').textContent,$('copy-instruction'));$('step-3').classList.add('done');};
try{const s=JSON.parse(sessionStorage.getItem(key));if(s&&s.expiresAt>Date.now()){saveTrip(s);void refresh();}}catch{}
setInterval(refresh,5000);
`;

const HTML = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MCPJam Flights</title>
<meta name="description" content="Delay or cancel a fictional flight and see the MCP Event reach your agent in MCPJam.">
<style>${CSS}</style></head><body>${BODY}<script>${SCRIPT}</script></body></html>`;

export function landing() {
  return new Response(HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

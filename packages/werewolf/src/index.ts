export const classicRoles = ['Simple Villager','Werewolf','Seer','Witch','Hunter','Cupid','Little Girl','Thief'] as const;
export const roles=[...classicRoles,'Defender','Village Idiot'] as const;
export type Role = typeof roles[number];
export type Pacing = 'RELAXED'|'STANDARD'|'FAST';
export type Settings = { ruleset: 'CLASSIC'|'CLASSIC_PLUS'|'CUSTOM'; preset: 'BASIC'|'POWERS'; roles?: Role[]; sheriff: boolean; pacing: Pacing; nightSeconds: number; discussionSeconds: number; revealDeaths: boolean };
export const defaultSettings: Settings = {ruleset:'CLASSIC',preset:'BASIC',sheriff:true,pacing:'RELAXED',nightSeconds:60,discussionSeconds:0,revealDeaths:true};
export type Step = 'THIEF'|'CUPID'|'LOVERS'|'DEFENDER'|'SEER'|'WOLVES'|'WITCH';
export type Phase = 'ROLE_REVEAL'|'SHERIFF_ELECTION'|'NIGHT'|'DAWN'|'DAY_DISCUSSION'|'VILLAGE_VOTE'|'VOTE_RESULT'|'SHERIFF_TIE'|'DEATH_RESOLUTION'|'GAME_OVER';
export type Source = 'WEREWOLVES'|'VILLAGE_VOTE'|'WITCH'|'HUNTER'|'LOVER';
export type Reaction = {kind:'HUNTER_SHOT'|'SHERIFF_SUCCESSION';player:string};
export type Death = {player:string;source:Source;day:number};
export type Player = {id:string;name:string;seat:number;connected:boolean;role:Role;originalRole:Role;alignment:'VILLAGE'|'WEREWOLVES';alive:boolean;confirmed:boolean;lover:string|null;loversConfirmed:boolean;voteRight:boolean;revealed:boolean;lastProtected:string|null;healing:boolean;poison:boolean;shot:boolean;knowledge:{day:number;player:string;role:Role}[];glimpses:{day:number;players:string[];caught:boolean}[]};
export type Outcome = {team:'VILLAGE'|'WEREWOLVES'|'LOVERS'|'NO_WINNER';winners:string[]};
export type Action =
  | {type:'CONFIRM_ROLE'|'ACK_LOVERS'|'READY'|'ADVANCE';window:number}
  | {type:'THIEF_CHOICE';window:number;choice:0|1|null}
  | {type:'CUPID_CHOICE';window:number;players:[string,string]}
  | {type:'DEFENDER_CHOICE'|'SEER_CHOICE'|'WOLF_CHOICE'|'VOTE'|'REACTION_CHOICE'|'SHERIFF_DECISION';window:number;target:string|null}
  | {type:'WOLF_LOCK';window:number}
  | {type:'WITCH_CHOICE';window:number;heal:boolean;poison:string|null}
  | {type:'PEEK';window:number;peek:boolean}
  | {type:'TIMEOUT'};
export type Prompt = {kind:Step|Reaction['kind']|'ROLE_REVEAL'|'SHERIFF_ELECTION'|'VILLAGE_VOTE'|'SHERIFF_TIE';window:number;targets:string[];locked:boolean;choice:string|null;choices?:Role[];victim?:string|null;heal?:boolean;poison?:boolean;pack?:{player:string;target:string|null;submitted:boolean;locked:boolean}[]};
export type Game = {gameVersion:1;seed:number;rng:number;settings:Settings;players:Player[];spares:Role[];phase:Phase;day:number;window:number;revision:number;publicRevision:number;step:Step;stepIndex:number;sheriff:string|null;sheriffElected:boolean;electionCandidates:string[];electionRunoff:boolean;votes:Record<string,string|null>;ready:string[];responses:Record<string,Action>;wolfChoices:Record<string,string|null>;wolfLocks:string[];protected:string|null;wolfVictim:string|null;poisonVictim:string|null;healed:boolean;deaths:Death[];deathQueue:Death[];reactions:Reaction[];continuation:'DAWN'|'NIGHT';outcome:Outcome|null;history:{day:number;text:string}[];truth:{day:number;text:string}[];voteResults:{day:number;kind:'SHERIFF_ELECTION'|'VILLAGE_VOTE';ballots:{player:string;target:string|null;weight:number}[];counts:Record<string,number>;ties:string[];result:string|null}[];actionLog:{day:number;phase:Phase;step:Step;actor:string;action:Action}[]};
export const roleDefinitions: Record<Role,{alignment:'VILLAGE'|'WEREWOLVES';first?:Step;night?:Step;summary:string}> = {
  'Simple Villager':{alignment:'VILLAGE',summary:'Listen, compare accounts and help the village identify the pack. You have no night power.'},
  Werewolf:{alignment:'WEREWOLVES',night:'WOLVES',summary:'Know your pack. Agree on one non-pack victim each night and conceal your identity by day.'},
  Seer:{alignment:'VILLAGE',night:'SEER',summary:'Privately learn one living player’s exact character each night.'},
  Witch:{alignment:'VILLAGE',night:'WITCH',summary:'One healing potion cancels the wolf attack. One poison eliminates a living player. Both may be used together, including on yourself.'},
  Hunter:{alignment:'VILLAGE',summary:'On elimination, fire a final shot before the game can finish; poison follows the dawn elimination interpretation.'},
  Cupid:{alignment:'VILLAGE',first:'CUPID',summary:'On the first night, choose two different Lovers, possibly yourself. Their lives become linked.'},
  'Little Girl':{alignment:'VILLAGE',night:'WOLVES',summary:'You may risk a partial glimpse during the pack’s window. Discovery redirects the wolf attack to you. This is an explicit digital adaptation.'},
  Defender:{alignment:'VILLAGE',night:'DEFENDER',summary:'Protect one living player from wolves each night, including yourself. Never repeat the same player on consecutive nights. Protection cannot shield the Little Girl or other death causes.'},
  'Village Idiot':{alignment:'VILLAGE',summary:'The village pardons your first execution, revealing you. You remain alive but lose voting rights. If you were Sheriff, that office is abolished.'},
  Thief:{alignment:'VILLAGE',first:'THIEF',summary:'Two extra Simple Villagers enter the shuffled pool. Inspect the two leftover cards and optionally take one; two wolves force a swap.'}
};
const steps: Step[] = ['THIEF','CUPID','LOVERS','DEFENDER','SEER','WOLVES','WITCH'];
function need(value:unknown,message:string):asserts value {if(!value)throw Error(message);}
export function recommendedRoles(count:number,preset:Settings['preset']='BASIC',expansion=false):Role[]{
  const wolves=count<12?2:count<18?3:4;
  const result:Role[]=Array(wolves).fill('Werewolf');
  result.push(...(preset==='BASIC'?['Seer'] as Role[]:classicRoles.filter(r=>!['Werewolf','Simple Villager'].includes(r))));
  if(expansion){if(count<result.length+2){for(const role of ['Thief','Little Girl'] as Role[]){const index=result.indexOf(role);if(index>=0)result.splice(index,1);}}result.push('Defender','Village Idiot');}
  while(result.length<count)result.push('Simple Villager');return result;
}
export function composition(count:number,settings:Settings){
  const cards=settings.ruleset==='CUSTOM'?(settings.roles||[]):recommendedRoles(count,settings.preset,settings.ruleset==='CLASSIC_PLUS');
  const errors:string[]=[];const warnings:string[]=[];
  if(count<8||count>18)errors.push('Classic supports 8–18 player seats.');
  if(cards.length!==count)errors.push(`Choose exactly ${count} role cards before the two Thief extras.`);
  for(const role of cards)if(!roles.includes(role))errors.push('An unsupported role is selected.');
  if(settings.ruleset==='CLASSIC'&&cards.some(r=>!classicRoles.includes(r as typeof classicRoles[number])))errors.push('Expansion characters require Classic Plus or Custom.');
  const wolves=cards.filter(r=>r==='Werewolf').length;
  if(wolves<1||wolves>4||wolves>=count)errors.push('Use 1–4 Werewolves and at least one Villager.');
  for(const role of roles.filter(r=>!['Werewolf','Simple Villager'].includes(r)))if(cards.filter(r=>r===role).length>1)errors.push(`Only one ${role} card is supported.`);
  if(cards.filter(r=>r==='Simple Villager').length+(cards.includes('Thief')?2:0)>13)errors.push('The Classic deck has thirteen Simple Villager cards.');
  if(!Number.isInteger(settings.nightSeconds)||settings.nightSeconds<10||settings.nightSeconds>600||!Number.isInteger(settings.discussionSeconds)||settings.discussionSeconds<0||settings.discussionSeconds>3600)errors.push('Night windows need 10–600 seconds; discussion may be unlimited or up to one hour.');
  if(settings.ruleset==='CLASSIC'&&!settings.revealDeaths)errors.push('Classic reveals characters on death. Use Custom to change this.');
  if(wolves===1)warnings.push('One Werewolf is fragile; the published basic composition uses two or more.');
  if(wolves===1&&cards.includes('Thief'))warnings.push('One wolf with Thief may leave no wolf among the dealt characters and end immediately.');
  if(cards.includes('Seer')&&cards.includes('Witch'))warnings.push('Seer and Witch give the Village strong information and survival powers.');
  if(cards.includes('Cupid')&&cards.includes('Hunter'))warnings.push('Lovers and Hunter can create several linked deaths.');
  if(cards.includes('Thief'))warnings.push('Thief makes the final dealt composition uncertain. Two Simple Villager cards are added before shuffling.');
  return {cards,errors,warnings,villagePower:cards.includes('Witch')&&cards.includes('Seer')?'High':'Moderate',werewolfPower:wolves>=3?'High':wolves===1?'Low':'Moderate',neutralComplexity:cards.includes('Cupid')?'Moderate':'Low',complexity:cards.includes('Thief')&&cards.includes('Cupid')?'High':settings.preset==='BASIC'?'Low':'Moderate'};
}
function random(game:Game){game.rng=(game.rng+0x6D2B79F5)>>>0;let x=game.rng;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return ((x^(x>>>14))>>>0)/4294967296;}
function shuffle<T>(game:Game,list:T[]){for(let i=list.length-1;i>0;i--){const j=Math.floor(random(game)*(i+1));[list[i],list[j]]=[list[j]!,list[i]!];}return list;}
const living=(game:Game)=>game.players.filter(p=>p.alive);
const player=(game:Game,id:string)=>{const found=game.players.find(p=>p.id===id);need(found,'Unknown player.');return found;};
function event(game:Game,text:string,secret=false){game.truth.push({day:game.day,text});if(!secret)game.history.push({day:game.day,text});}
function enter(game:Game,phase:Phase){game.phase=phase;game.window++;game.publicRevision++;game.ready=[];game.votes={};}
export function createGame(seats:{id:string;name:string}[],seed:number,options:Partial<Settings>={}):Game{
  const settings={...defaultSettings,...options};const setup=composition(seats.length,settings);need(!setup.errors.length,setup.errors.join(' '));need(new Set(seats.map(p=>p.id)).size===seats.length,'Seats must be unique.');
  const game:Game={gameVersion:1,seed,rng:seed>>>0,settings,players:[],spares:[],phase:'ROLE_REVEAL',day:1,window:1,revision:0,publicRevision:0,step:'THIEF',stepIndex:0,protected:null,sheriff:null,sheriffElected:!settings.sheriff,electionCandidates:[],electionRunoff:false,votes:{},ready:[],responses:{},wolfChoices:{},wolfLocks:[],wolfVictim:null,poisonVictim:null,healed:false,deaths:[],deathQueue:[],reactions:[],continuation:'DAWN',outcome:null,history:[],truth:[],voteResults:[],actionLog:[]};
  const deck=shuffle(game,[...setup.cards,...(setup.cards.includes('Thief')?['Simple Villager','Simple Villager'] as Role[]:[])]);
  game.players=seats.map((seat,i)=>{const role=deck[i]!;return {...seat,seat:i,connected:true,role,originalRole:role,alignment:roleDefinitions[role].alignment,alive:true,confirmed:false,lover:null,loversConfirmed:false,voteRight:true,revealed:false,lastProtected:null,healing:true,poison:true,shot:false,knowledge:[],glimpses:[]};});game.spares=deck.slice(seats.length);event(game,'The village gathers. Roles are sealed.');validateGame(game);return game;
}
export function getNightSchedule(game:Game){return steps.map(step=>({step,actors:living(game).filter(p=>(game.day===1&&roleDefinitions[p.role].first===step)||roleDefinitions[p.role].night===step||step==='LOVERS'&&game.day===1&&!!p.lover).map(p=>p.id)}));}
function startNight(game:Game){enter(game,'NIGHT');game.stepIndex=0;game.step=steps[0]!;game.responses={};game.wolfChoices={};game.wolfLocks=[];game.protected=null;game.wolfVictim=null;game.poisonVictim=null;game.healed=false;event(game,`Night ${game.day} falls. The village sleeps.`);}
export function evaluateVictory(game:Game):Outcome|null{
  if(game.deathQueue.length||game.reactions.length)return null;
  const alive=living(game);if(!alive.length)return{team:'NO_WINNER',winners:[]};
  if(alive.length===2&&alive[0]!.lover===alive[1]!.id&&alive[0]!.alignment!==alive[1]!.alignment)return{team:'LOVERS',winners:alive.map(p=>p.id)};
  const wolves=alive.filter(p=>p.alignment==='WEREWOLVES');const villagers=alive.filter(p=>p.alignment==='VILLAGE');
  const team=!wolves.length?'VILLAGE':!villagers.length?'WEREWOLVES':null;
  return team?{team,winners:game.players.filter(p=>p.alignment===team&&(!p.lover||player(game,p.lover).alignment===p.alignment)).map(p=>p.id)}:null;
}
function finishIfWon(game:Game){const outcome=evaluateVictory(game);if(!outcome)return false;game.outcome=outcome;enter(game,'GAME_OVER');event(game,outcome.team==='NO_WINNER'?'The village is empty. No side wins.':`${outcome.team==='LOVERS'?'The Lovers':outcome.team==='VILLAGE'?'The Village':'The Werewolves'} win.`);return true;}
export function queueDeaths(game:Game,deaths:Omit<Death,'day'>[],continuation:Game['continuation']){
  game.continuation=continuation;for(const death of deaths)if(player(game,death.player).alive&&!game.deathQueue.some(d=>d.player===death.player))game.deathQueue.push({...death,day:game.day});
  enter(game,'DEATH_RESOLUTION');drainDeaths(game);
}
function drainDeaths(game:Game){
  while(game.deathQueue.length){const death=game.deathQueue.shift()!;const p=player(game,death.player);if(!p.alive)continue;if(p.role==='Village Idiot'&&death.source==='VILLAGE_VOTE'){p.revealed=true;p.voteRight=false;if(game.sheriff===p.id)game.sheriff=null;event(game,`${p.name} is the Village Idiot: pardoned, but no longer allowed to vote.`);continue;}p.alive=false;game.deaths.push(death);event(game,`${p.name} has died.${game.settings.revealDeaths?` Character: ${p.role}.`:''}`);event(game,`${p.name}: death caused by ${death.source}.`,true);
    if(p.lover&&player(game,p.lover).alive&&!game.deathQueue.some(d=>d.player===p.lover))game.deathQueue.push({player:p.lover,source:'LOVER',day:game.day});
    if(p.role==='Hunter'&&!p.shot)game.reactions.push({kind:'HUNTER_SHOT',player:p.id});
    if(game.sheriff===p.id){game.sheriff=null;game.reactions.push({kind:'SHERIFF_SUCCESSION',player:p.id});}
  }
  game.reactions=game.reactions.filter(r=>living(game).length>0&&(r.kind!=='HUNTER_SHOT'||!player(game,r.player).shot));
  if(game.reactions.length){game.window++;game.publicRevision++;return;}
  if(finishIfWon(game))return;
  if(game.continuation==='DAWN'){enter(game,'DAWN');event(game,`Dawn ${game.day}. The village wakes.`);}else{game.day++;startNight(game);}
}
function resolveNightWindow(game:Game){
  const actors=getNightSchedule(game)[game.stepIndex]!.actors;
  for(const id of actors){const p=player(game,id);const response=game.responses[id];
    if(game.step==='THIEF'&&p.role==='Thief'&&game.day===1){const choice=response?.type==='THIEF_CHOICE'?response.choice:game.spares.every(r=>r==='Werewolf')?0:null;if(choice!==null){const next=game.spares[choice]!;game.spares[choice]=p.role;p.role=next;p.alignment=roleDefinitions[next].alignment;event(game,`${p.name} exchanged Thief for ${next}.`,true);}}
    if(game.step==='CUPID'&&p.role==='Cupid'&&game.day===1){const pair=response?.type==='CUPID_CHOICE'?response.players:living(game).slice(0,2).map(p=>p.id);const a=player(game,pair[0]!),b=player(game,pair[1]!);a.lover=b.id;b.lover=a.id;event(game,`${p.name} linked ${a.name} and ${b.name} as Lovers.`,true);}
    if(game.step==='DEFENDER'&&p.role==='Defender'){const target=response?.type==='DEFENDER_CHOICE'?response.target:null;game.protected=target;p.lastProtected=target;if(target)event(game,`${p.name} protected ${player(game,target).name}.`,true);}
    if(game.step==='SEER'&&response?.type==='SEER_CHOICE'&&response.target){const target=player(game,response.target);p.knowledge.push({day:game.day,player:target.id,role:target.role});event(game,`${p.name} inspected ${target.name}: ${target.role}.`,true);}
    if(game.step==='WITCH'&&response?.type==='WITCH_CHOICE'){if(response.heal){p.healing=false;game.healed=true;}if(response.poison){p.poison=false;game.poisonVictim=response.poison;}event(game,`${p.name} chose ${response.heal?'healing':'no healing'} and ${response.poison?`poison for ${player(game,response.poison).name}`:'no poison'}.`,true);}
  }
  if(game.step==='WOLVES'){
    const wolves=living(game).filter(p=>p.alignment==='WEREWOLVES');const choices=wolves.map(p=>game.wolfChoices[p.id]??null);game.wolfVictim=choices.length&&choices.every(c=>c===choices[0])?choices[0]!:null;
    const girl=living(game).find(p=>p.role==='Little Girl');if(girl&&game.responses[girl.id]?.type==='PEEK'&&(game.responses[girl.id] as Extract<Action,{type:'PEEK'}>).peek){const caught=random(game)<1/3;const wolf=shuffle(game,[...wolves])[0];const others=shuffle(game,living(game).filter(p=>p.id!==girl.id&&p.id!==wolf?.id)).slice(0,2);const glimpse=wolf?shuffle(game,[wolf,...others]).map(p=>p.id):[];girl.glimpses.push({day:game.day,players:glimpse,caught});if(caught&&wolves.length)game.wolfVictim=girl.id;event(game,`${girl.name} peeked${caught?' and was discovered':''}.`,true);}
    event(game,game.wolfVictim?`The pack targeted ${player(game,game.wolfVictim).name}.`:'The pack selected no victim.',true);
  }
  game.responses={};game.stepIndex++;game.window++;
  if(game.stepIndex<steps.length){game.step=steps[game.stepIndex]!;return;}
  const deaths:Omit<Death,'day'>[]=[];if(game.wolfVictim&&!game.healed&&(game.protected!==game.wolfVictim||player(game,game.wolfVictim).role==='Little Girl'))deaths.push({player:game.wolfVictim,source:'WEREWOLVES'});if(game.poisonVictim)deaths.push({player:game.poisonVictim,source:'WITCH'});queueDeaths(game,deaths,'DAWN');
}
function eligibleVoters(game:Game){return living(game).filter(p=>p.voteRight);}
function voteTargets(game:Game,p:Player){return living(game).filter(t=>(game.phase!=='VILLAGE_VOTE'||t.id!==p.lover&&!t.revealed)&&(!game.electionRunoff||game.electionCandidates.includes(t.id))).map(p=>p.id);}
function resolveVote(game:Game){
  const ballots=eligibleVoters(game).map(p=>({player:p.id,target:game.votes[p.id]??null,weight:game.phase==='VILLAGE_VOTE'&&p.id===game.sheriff?2:1}));const counts:Record<string,number>={};for(const b of ballots)if(b.target)counts[b.target]=(counts[b.target]||0)+b.weight;
  const maximum=Math.max(0,...Object.values(counts));const ties=maximum?living(game).filter(p=>counts[p.id]===maximum).map(p=>p.id):[];
  const result=ties.length===1?ties[0]!:null;const kind=game.phase as 'SHERIFF_ELECTION'|'VILLAGE_VOTE';game.voteResults.push({day:game.day,kind,ballots,counts,ties,result});
  if(kind==='SHERIFF_ELECTION'){
    if(!result&&!game.electionRunoff&&ties.length){game.electionRunoff=true;game.electionCandidates=ties;enter(game,'SHERIFF_ELECTION');event(game,'Sheriff election tied. A runoff begins.');return;}
    game.sheriff=result||ties[0]||living(game)[0]!.id;game.sheriffElected=true;game.electionRunoff=false;game.electionCandidates=[];event(game,`${player(game,game.sheriff).name} is Sheriff.`);startNight(game);return;
  }
  enter(game,'VOTE_RESULT');event(game,result?`The village selected ${player(game,result).name}.`:ties.length?'The village vote is tied.':'No village vote was cast.');
}
export function getPrompt(game:Game,id:string):Prompt|null{
  const p=player(game,id);const base={window:game.window,targets:[] as string[],locked:false,choice:null};
  const reaction=game.reactions[0];if(game.phase==='DEATH_RESOLUTION')return reaction?.player===id?{...base,kind:reaction.kind,targets:living(game).map(p=>p.id)}:null;
  if(!p.alive)return null;
  if(game.phase==='SHERIFF_TIE')return game.sheriff===id?{...base,kind:'SHERIFF_TIE',targets:game.voteResults.at(-1)!.ties.filter(t=>t!==p.lover)}:null;
  if(game.phase==='ROLE_REVEAL')return{...base,kind:'ROLE_REVEAL',locked:p.confirmed};
  if(['SHERIFF_ELECTION','VILLAGE_VOTE'].includes(game.phase))return !p.voteRight?null:{...base,kind:game.phase as 'SHERIFF_ELECTION'|'VILLAGE_VOTE',targets:voteTargets(game,p),locked:id in game.votes,choice:game.votes[id]??null};
  if(game.phase!=='NIGHT'||!getNightSchedule(game)[game.stepIndex]?.actors.includes(id))return null;
  const response=game.responses[id];const prompt:Prompt={...base,kind:game.step,targets:living(game).map(p=>p.id),locked:!!response};
  if(game.step==='THIEF'){prompt.choices=game.spares;prompt.targets=[];}
  if(game.step==='LOVERS'){prompt.targets=[];prompt.locked=p.loversConfirmed;}
  if(game.step==='DEFENDER')prompt.targets=prompt.targets.filter(id=>id!==p.lastProtected);
  if(game.step==='SEER')prompt.targets=prompt.targets.filter(t=>t!==id);
  if(game.step==='WOLVES'&&p.alignment==='WEREWOLVES'){prompt.targets=living(game).filter(t=>t.alignment!=='WEREWOLVES').map(p=>p.id);prompt.pack=living(game).filter(t=>t.alignment==='WEREWOLVES').map(p=>({player:p.id,target:game.wolfChoices[p.id]??null,submitted:p.id in game.wolfChoices,locked:game.wolfLocks.includes(p.id)}));prompt.locked=game.wolfLocks.includes(id);prompt.choice=game.wolfChoices[id]??null;}
  if(game.step==='WITCH'){prompt.victim=game.wolfVictim;prompt.heal=p.healing;prompt.poison=p.poison;}
  return prompt;
}
export function applyAction(original:Game,actor:string,action:Action):Game{
  need(original.phase!=='GAME_OVER','The match has finished.');const game=structuredClone(original);
  if(action.type==='TIMEOUT'){
    need(actor==='@system','Only the server controls timeouts.');
    if(game.phase==='NIGHT')resolveNightWindow(game);
    else if(game.phase==='ROLE_REVEAL'){for(const p of game.players)p.confirmed=true;if(game.settings.sheriff)enter(game,'SHERIFF_ELECTION');else startNight(game);}
    else if(game.phase==='SHERIFF_ELECTION'||game.phase==='VILLAGE_VOTE')resolveVote(game);
    else if(game.phase==='DEATH_RESOLUTION'){const r=game.reactions.shift();need(r,'No reaction is pending.');if(r.kind==='HUNTER_SHOT'){player(game,r.player).shot=true;const target=living(game)[0];if(target){game.deathQueue.push({player:target.id,source:'HUNTER',day:game.day});event(game,`${player(game,r.player).name} timed out: mandatory final shot uses first living seat ${target.name}.`,true);}}else{game.sheriff=living(game)[0]?.id??null;event(game,game.sheriff?`${player(game,game.sheriff).name} succeeds as Sheriff.`:'The Sheriff office is vacant.');}drainDeaths(game);}
    else if(game.phase==='SHERIFF_TIE'){game.day++;startNight(game);}
    else advance(game);
  }else{
    const p=player(game,actor);need(action.window===game.window,'That prompt has closed.');const prompt=getPrompt(game,actor);const reacting=game.phase==='DEATH_RESOLUTION'&&game.reactions[0]?.player===actor;need(p.alive||reacting,'Dead players cannot act.');
    if(action.type==='CONFIRM_ROLE'){need(game.phase==='ROLE_REVEAL'&&!p.confirmed,'Role confirmation is unavailable.');p.confirmed=true;if(living(game).every(p=>p.confirmed)){if(game.settings.sheriff)enter(game,'SHERIFF_ELECTION');else startNight(game);}}
    else if(action.type==='READY'){need(game.phase==='DAY_DISCUSSION'&&!game.ready.includes(actor),'Readiness is unavailable.');game.ready.push(actor);if(living(game).every(p=>game.ready.includes(p.id)))advance(game);}
    else if(action.type==='ADVANCE'){need(['DAWN','DAY_DISCUSSION','VOTE_RESULT'].includes(game.phase),'The moderator controls this phase.');need(actor===living(game)[0]?.id||game.ready.length===living(game).length,'The discussion chair advances this window.');advance(game);}
    else if(action.type==='VOTE'){need(prompt?.kind==='SHERIFF_ELECTION'||prompt?.kind==='VILLAGE_VOTE','Voting is unavailable.');need(!prompt.locked,'Your vote is locked.');need(action.target===null||prompt.targets.includes(action.target),'That vote target is unavailable.');game.votes[actor]=action.target;if(eligibleVoters(game).every(p=>p.id in game.votes))resolveVote(game);}
    else if(action.type==='SHERIFF_DECISION'){need(prompt?.kind==='SHERIFF_TIE'&&action.target!==null&&prompt.targets.includes(action.target),'Choose an eligible tied player.');game.voteResults.at(-1)!.result=action.target;queueDeaths(game,[{player:action.target,source:'VILLAGE_VOTE'}],'NIGHT');}
    else if(action.type==='REACTION_CHOICE'){need(reacting&&!!prompt,'That reaction is unavailable.');need(action.target!==null&&prompt.targets.includes(action.target),'Choose a living player.');const r=game.reactions.shift()!;if(r.kind==='HUNTER_SHOT'){need(!p.shot,'The Hunter already fired.');p.shot=true;event(game,`${p.name} fired a final shot at ${player(game,action.target).name}.`,true);game.deathQueue.push({player:action.target,source:'HUNTER',day:game.day});}else{game.sheriff=action.target;event(game,`${player(game,action.target).name} succeeds ${p.name} as Sheriff.`);}drainDeaths(game);}
    else{
      need(game.phase==='NIGHT'&&!!prompt,'You have no private action in this window.');need(!prompt.locked,'Your response is locked.');
      if(action.type==='THIEF_CHOICE'){need(p.role==='Thief'&&game.step==='THIEF'&&game.day===1,'Thief choice is unavailable.');need(action.choice===null||game.spares[action.choice]!==undefined,'Choose an available spare.');need(action.choice!==null||!game.spares.every(r=>r==='Werewolf'),'Two wolf spares require a swap.');}
      else if(action.type==='CUPID_CHOICE'){need(p.role==='Cupid'&&game.step==='CUPID'&&game.day===1&&!game.players.some(p=>p.lover),'Cupid choice is unavailable.');need(action.players.length===2&&action.players[0]!==action.players[1]&&action.players.every(id=>prompt.targets.includes(id)),'Choose two different living Lovers.');}
      else if(action.type==='ACK_LOVERS'){need(game.step==='LOVERS'&&game.day===1&&!!p.lover,'Lover recognition is unavailable.');p.loversConfirmed=true;}
      else if(action.type==='DEFENDER_CHOICE'){need(p.role==='Defender'&&game.step==='DEFENDER','Defender choice is unavailable.');need(action.target===null||prompt.targets.includes(action.target),'Do not repeat the same protected player on consecutive nights.');}
      else if(action.type==='SEER_CHOICE'){need(p.role==='Seer'&&game.step==='SEER','Seer choice is unavailable.');need(action.target===null||prompt.targets.includes(action.target),'Choose another living player.');}
      else if(action.type==='WOLF_CHOICE'){need(p.alignment==='WEREWOLVES'&&game.step==='WOLVES','Pack choice is unavailable.');need(action.target===null||prompt.targets.includes(action.target),'Werewolves cannot target pack members.');game.wolfChoices[actor]=action.target;}
      else if(action.type==='WOLF_LOCK'){need(p.alignment==='WEREWOLVES'&&game.step==='WOLVES'&&actor in game.wolfChoices,'Choose a pack intention first.');game.wolfLocks.push(actor);}
      else if(action.type==='WITCH_CHOICE'){need(p.role==='Witch'&&game.step==='WITCH','Witch choice is unavailable.');need(!action.heal||p.healing&&game.wolfVictim!==null,'Healing is unavailable.');need(action.poison===null||p.poison&&prompt.targets.includes(action.poison),'Poison is unavailable.');}
      else if(action.type==='PEEK'){need(p.role==='Little Girl'&&game.step==='WOLVES','Peeking is unavailable.');}
      else throw Error('Unsupported action.');
      if(action.type!=='WOLF_CHOICE')game.responses[actor]=action;
    }
  }
  game.revision++;if(game.phase!=='NIGHT')game.publicRevision++;game.actionLog.push({day:original.day,phase:original.phase,step:original.step,actor,action});validateGame(game);return game;
}
function advance(game:Game){
  if(game.phase==='DAWN'){enter(game,'DAY_DISCUSSION');event(game,'Discuss what the village knows.');}
  else if(game.phase==='DAY_DISCUSSION'){enter(game,'VILLAGE_VOTE');event(game,'The village votes together.');}
  else if(game.phase==='VOTE_RESULT'){
    const vote=game.voteResults.at(-1)!;
    if(vote.result)queueDeaths(game,[{player:vote.result,source:'VILLAGE_VOTE'}],'NIGHT');
    else if(vote.ties.length&&game.sheriff)enter(game,'SHERIFF_TIE');
    else{game.day++;startNight(game);}
  }else throw Error('The phase cannot advance.');
}
export function project(game:Game,viewerId:string|null){
  const self=game.players.find(p=>p.id===viewerId);const prompt=self?getPrompt(game,self.id):null;
  return {gameVersion:game.gameVersion,revision:game.publicRevision,phase:game.phase,day:game.day,window:game.phase==='NIGHT'?null:game.window,players:game.players.map(p=>({id:p.id,name:p.name,seat:p.seat,connected:p.connected,alive:p.alive,revealed:p.revealed,voteRight:p.voteRight,role:p.revealed||!p.alive&&game.settings.revealDeaths||game.phase==='GAME_OVER'?p.role:null})),sheriff:game.sheriff,chair:living(game)[0]?.id??null,ready:game.ready,history:game.history,voteResults:game.voteResults,settings:{...game.settings,roles:undefined},outcome:game.outcome,
    self:self?{id:self.id,role:self.role,alignment:self.alignment,alive:self.alive,confirmed:self.confirmed,lover:self.lover,knowledge:self.knowledge,glimpses:self.glimpses,healing:self.role==='Witch'?self.healing:null,poison:self.role==='Witch'?self.poison:null,pack:self.alive&&self.alignment==='WEREWOLVES'?living(game).filter(p=>p.alignment==='WEREWOLVES').map(p=>p.id):[],prompt}:null,
    truth:game.phase==='GAME_OVER'?{players:game.players.map(p=>({id:p.id,role:p.role,originalRole:p.originalRole,alignment:p.alignment,lover:p.lover})),events:game.truth,actions:game.actionLog}:null};
}
export type View=ReturnType<typeof project>;
export function validateGame(game:Game){
  need(game.gameVersion===1&&Number.isInteger(game.window)&&game.window>0,'Invalid game version/window.');need(game.players.length>=8&&game.players.length<=18,'Invalid village size.');need(new Set(game.players.map(p=>p.id)).size===game.players.length,'Duplicate seat.');
  for(const [i,p] of game.players.entries()){need(p.seat===i&&roles.includes(p.role)&&p.alignment===roleDefinitions[p.role].alignment,'Invalid layered identity.');if(p.lover)need(p.lover!==p.id&&player(game,p.lover).lover===p.id,'Invalid Lover relationship.');}
  need(!game.sheriff||player(game,game.sheriff).alive,'A dead Sheriff cannot hold office.');need(new Set(game.deaths.map(d=>d.player)).size===game.deaths.length,'Duplicate death.');need(game.players.filter(p=>!p.alive).length===game.deaths.length,'Death inventory mismatch.');
  const initial=composition(game.players.length,game.settings).cards;const expected=[...initial,...(initial.includes('Thief')?['Simple Villager','Simple Villager']:[])];const actual=[...game.players.map(p=>p.role),...game.spares];for(const role of roles)need(actual.filter(r=>r===role).length===expected.filter(r=>r===role).length,'Role-card inventory mismatch.');
  for(const id of Object.keys(game.votes))need(player(game,id).alive,'A dead player voted.');for(const r of game.reactions)need(!player(game,r.player).alive,'Death reactions require a dead actor.');
  if(game.phase==='NIGHT')need(steps[game.stepIndex]===game.step,'Invalid night schedule.');if(game.phase==='GAME_OVER')need(!!game.outcome&&!game.reactions.length&&!game.deathQueue.length,'Unresolved victory.');
}
export const serializeGame=(game:Game)=>JSON.stringify(game);
export function restoreGame(text:string){const game=JSON.parse(text) as Game;validateGame(game);return game;}
export function replayGame(seats:{id:string;name:string}[],seed:number,settings:Partial<Settings>,log:Game['actionLog']){let game=createGame(seats,seed,settings);for(const entry of log)game=applyAction(game,entry.actor,entry.action);return game;}

import { applyAction, createGame, project, validateGame, type Action, type Settings, type View } from './index.js';
export function nextBotAction(view:View,id:string):Action|null{
  const self=view.self;if(!self||self.id!==id||view.phase==='GAME_OVER')return null;
  const prompt=self.prompt;const window=prompt?.window??view.window!;
  const names=view.players.filter(p=>p.alive);const variation=(view.day*7+view.players.findIndex(p=>p.id===id)*3)%Math.max(1,names.length);
  const target=(targets:string[])=>{const known=targets.find(t=>self.knowledge.some(k=>k.player===t&&k.role==='Werewolf'));return known||targets.filter(t=>t!==id&&t!==self.lover&&!self.pack.includes(t))[variation%Math.max(1,targets.filter(t=>t!==id&&t!==self.lover&&!self.pack.includes(t)).length)]||targets[0]||null;};
  if(view.phase==='DAY_DISCUSSION'&&self.alive&&!view.ready.includes(id))return{type:'READY',window};
  if(['DAWN','VOTE_RESULT'].includes(view.phase)&&view.chair===id)return{type:'ADVANCE',window};
  if(!prompt||prompt.locked)return null;
  switch(prompt.kind){
    case 'ROLE_REVEAL':return{type:'CONFIRM_ROLE',window};
    case 'THIEF':{const choices=prompt.choices!;return{type:'THIEF_CHOICE',window,choice:choices.includes('Seer')?choices.indexOf('Seer') as 0|1:choices[0]==='Werewolf'&&choices[1]==='Werewolf'?0:choices[0]==='Simple Villager'?0:null};}
    case 'CUPID':{const pair=prompt.targets.filter(t=>t!==id).slice(0,2);return{type:'CUPID_CHOICE',window,players:[pair[0]!,pair[1]!]};}
    case 'LOVERS':return{type:'ACK_LOVERS',window};
    case 'DEFENDER':return{type:'DEFENDER_CHOICE',window,target:prompt.targets.includes(id)?id:target(prompt.targets)};
    case 'SEER':return{type:'SEER_CHOICE',window,target:target(prompt.targets.filter(t=>!self.knowledge.some(k=>k.player===t)))};
    case 'WOLVES':
      if(self.role==='Little Girl')return{type:'PEEK',window,peek:view.day%2===1};
      if(prompt.pack?.some(p=>p.player===id&&p.submitted))return{type:'WOLF_LOCK',window};
      return{type:'WOLF_CHOICE',window,target:prompt.pack?.find(p=>p.target&&prompt.targets.includes(p.target))?.target||prompt.targets.find(t=>t!==self.lover)||null};
    case 'WITCH':return{type:'WITCH_CHOICE',window,heal:!!prompt.heal&&!!prompt.victim&&(prompt.victim===id||prompt.victim===self.lover||view.day===1),poison:prompt.poison&&(names.length<=5||self.knowledge.some(k=>k.role==='Werewolf'))?target(prompt.targets):null};
    case 'SHERIFF_ELECTION':return{type:'VOTE',window,target:prompt.targets[0]||null};
    case 'VILLAGE_VOTE':return{type:'VOTE',window,target:target(prompt.targets)};
    case 'SHERIFF_TIE':return{type:'SHERIFF_DECISION',window,target:target(prompt.targets)};
    case 'HUNTER_SHOT':case 'SHERIFF_SUCCESSION':return{type:'REACTION_CHOICE',window,target:target(prompt.targets)};
  }
}
export function simulate(seed:number,count=10,settings:Partial<Settings>={}){
  let game=createGame(Array.from({length:count},(_,i)=>({id:`p${i}`,name:`Player ${i+1}`})),seed,{preset:seed%2?'POWERS':'BASIC',...settings});let actions=0;
  while(game.phase!=='GAME_OVER'&&actions++<4000){
    const choice=game.players.map(p=>({actor:p.id,action:nextBotAction(project(game,p.id),p.id)})).find(c=>c.action);
    try {game=choice?.action?applyAction(game,choice.actor,choice.action):applyAction(game,'@system',{type:'TIMEOUT'});validateGame(game);const spectator=project(game,null);if(spectator.self||spectator.truth&&game.phase!=='GAME_OVER'||spectator.players.some(p=>p.alive&&p.role&&!p.revealed&&game.phase!=='GAME_OVER'))throw Error('Privacy failure.');}
    catch(error){throw Error(`seed ${seed}, day ${game.day}, phase ${game.phase}, step ${game.step}, action ${actions}: ${(error as Error).message}`);}
  }
  if(!game.outcome)throw Error(`Deadlock: seed ${seed}, day ${game.day}, phase ${game.phase}, action ${actions}`);
  return {winner:game.outcome.team,days:game.day,nightDeaths:game.deaths.filter(d=>['WEREWOLVES','WITCH'].includes(d.source)).length,voteDeaths:game.deaths.filter(d=>d.source==='VILLAGE_VOTE').length,potions:game.players.filter(p=>!p.healing).length+game.players.filter(p=>!p.poison).length,sheriffSurvived:!!game.sheriff,roleWins:game.players.map(p=>({role:p.role,won:game.outcome!.winners.includes(p.id)})),actions,game};
}

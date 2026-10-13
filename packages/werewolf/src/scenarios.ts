import { createGame, queueDeaths, validateGame, type Game, type Step, type Role } from './index.js';
export const scenarioNames=['CLASSIC_FIRST_NIGHT','ROLE_REVEAL','SIMPLE_VILLAGER_REVEAL','THIEF_SETUP','CUPID','LOVERS_REVEAL','SEER_DISCOVERY','WEREWOLF_PHASE','WITCH_SAVE','WITCH_POISON','LITTLE_GIRL_TEST','DAWN','DISCUSSION','SHERIFF_ELECTION','VILLAGE_VOTE','VOTE_TIE','HUNTER_CHAIN','SHERIFF_DEATH','MULTI_DEATH','VILLAGE_WIN_BASIC','WEREWOLF_WIN_BASIC','CUPID_CROSS_TEAM_LOVERS','DEAD_PLAYER','EIGHTEEN_PLAYERS','DEFENDER','IDIOT_PARDON','IDIOT_DEATH'] as const;
export function createScenario(name:typeof scenarioNames[number],seats:{id:string;name:string}[],seed=42):Game{
  const cards:Role[]=['Werewolf','Werewolf','Seer','Witch','Hunter','Cupid','Little Girl','Thief'];while(cards.length<seats.length)cards.push('Simple Villager');
  if(name==='SIMPLE_VILLAGER_REVEAL')cards[6]='Simple Villager';
  if(['DEFENDER','IDIOT_PARDON','IDIOT_DEATH'].includes(name)){cards[6]='Defender';cards[7]='Village Idiot';}
  const game=createGame(seats,seed,{ruleset:'CUSTOM',roles:cards,preset:'POWERS'});game.players.forEach((p,i)=>{p.role=cards[i]!;p.originalRole=p.role;p.alignment=p.role==='Werewolf'?'WEREWOLVES':'VILLAGE';p.confirmed=true;});game.spares=cards.includes('Thief')?['Simple Villager','Simple Villager']:[];game.sheriffElected=true;
  const desired:Partial<Record<typeof name,Role>>={ROLE_REVEAL:'Seer',SIMPLE_VILLAGER_REVEAL:'Simple Villager',CLASSIC_FIRST_NIGHT:'Thief',THIEF_SETUP:'Thief',CUPID:'Cupid',SEER_DISCOVERY:'Seer',WITCH_SAVE:'Witch',WITCH_POISON:'Witch',LITTLE_GIRL_TEST:'Little Girl',HUNTER_CHAIN:'Hunter',DEFENDER:'Defender',IDIOT_PARDON:'Village Idiot',IDIOT_DEATH:'Village Idiot'};
  if(desired[name]){const target=game.players.find(p=>p.role===desired[name])!;[game.players[0]!.role,target.role]=[target.role,game.players[0]!.role];for(const p of game.players){p.originalRole=p.role;p.alignment=p.role==='Werewolf'?'WEREWOLVES':'VILLAGE';}}
  const map:Partial<Record<typeof name,Step>>={CLASSIC_FIRST_NIGHT:'THIEF',THIEF_SETUP:'THIEF',CUPID:'CUPID',LOVERS_REVEAL:'LOVERS',SEER_DISCOVERY:'SEER',WEREWOLF_PHASE:'WOLVES',WITCH_SAVE:'WITCH',WITCH_POISON:'WITCH',LITTLE_GIRL_TEST:'WOLVES',DEFENDER:'DEFENDER'};
  if(map[name]){game.phase='NIGHT';game.step=map[name]!;game.stepIndex=['THIEF','CUPID','LOVERS','DEFENDER','SEER','WOLVES','WITCH'].indexOf(game.step);}
  else game.phase=name==='ROLE_REVEAL'||name==='SIMPLE_VILLAGER_REVEAL'?'ROLE_REVEAL':name==='SHERIFF_ELECTION'?'SHERIFF_ELECTION':name==='DAWN'?'DAWN':name==='VILLAGE_VOTE'?'VILLAGE_VOTE':'DAY_DISCUSSION';
  if(name==='ROLE_REVEAL'||name==='SIMPLE_VILLAGER_REVEAL')for(const p of game.players)p.confirmed=false;
  if(name.startsWith('WITCH'))game.wolfVictim=game.players[0]!.id;
  if(['LOVERS_REVEAL','CUPID_CROSS_TEAM_LOVERS','HUNTER_CHAIN'].includes(name)){game.players[0]!.lover=game.players[4]!.id;game.players[4]!.lover=game.players[0]!.id;}
  if(name==='HUNTER_CHAIN')queueDeaths(game,[{player:game.players[0]!.id,source:'WEREWOLVES'}],'DAWN');
  if(name==='SHERIFF_DEATH'){game.sheriff=game.players[0]!.id;queueDeaths(game,[{player:game.sheriff,source:'VILLAGE_VOTE'}],'NIGHT');}
  if(name==='MULTI_DEATH')queueDeaths(game,[{player:game.players[4]!.id,source:'WEREWOLVES'},{player:game.players[3]!.id,source:'WITCH'}],'DAWN');
  if(name==='DEAD_PLAYER')queueDeaths(game,[{player:game.players[0]!.id,source:'WEREWOLVES'}],'DAWN');
  if(name==='IDIOT_PARDON'){game.sheriff=game.players[0]!.id;queueDeaths(game,[{player:game.players[0]!.id,source:'VILLAGE_VOTE'}],'DAWN');}
  if(name==='IDIOT_DEATH')queueDeaths(game,[{player:game.players[0]!.id,source:'WEREWOLVES'}],'DAWN');
  if(name==='VOTE_TIE'){game.phase='VOTE_RESULT';game.sheriff=game.players[2]!.id;game.voteResults.push({day:1,kind:'VILLAGE_VOTE',ballots:[],counts:{[game.players[0]!.id]:3,[game.players[1]!.id]:3},ties:[game.players[0]!.id,game.players[1]!.id],result:null});}
  if(name==='VILLAGE_WIN_BASIC')queueDeaths(game,game.players.filter(p=>p.role==='Werewolf').map(p=>({player:p.id,source:'VILLAGE_VOTE' as const})),'DAWN');
  if(name==='WEREWOLF_WIN_BASIC'){for(const p of game.players)if(p.role!=='Werewolf'){p.alive=false;game.deaths.push({player:p.id,source:'WITCH',day:1});}game.outcome={team:'WEREWOLVES',winners:game.players.filter(p=>p.role==='Werewolf').map(p=>p.id)};game.phase='GAME_OVER';}
  if(name==='CUPID_CROSS_TEAM_LOVERS'){for(const p of game.players)if(![game.players[0]!.id,game.players[4]!.id].includes(p.id)){p.alive=false;game.deaths.push({player:p.id,source:'VILLAGE_VOTE',day:1});}game.outcome={team:'LOVERS',winners:[game.players[0]!.id,game.players[4]!.id]};game.phase='GAME_OVER';}
  validateGame(game);return game;
}

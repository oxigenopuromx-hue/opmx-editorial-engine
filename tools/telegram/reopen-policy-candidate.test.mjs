import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOpenCommand,decideReopen,blockedNotice} from './reopen-policy-candidate.mjs';

const id='tg_'+'a'.repeat(40);
const base=()=>({actor:{userId:'123',chatId:'123',authenticated:true,isAdmin:false},pkg:{id,ownerId:'123',revision:7,state:'READY'},session:{state:'NONE'},processing:{revision:7,state:'TERMINAL_BLOCKED',noActiveAttempts:true},publication:{revision:7,verdict:'NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'}});
test('the complete command names exactly one package',()=>{assert.deepEqual(parseOpenCommand('/abrir '+id),{packageId:id});for(const x of ['/abrir','/abrir '+id+' otro','/abrir tg_123','/abrir@bot '+id])assert.equal(parseOpenCommand(x),null);});
test('owner and administrator can request safe recovery',()=>{assert.deepEqual(decideReopen(base()),{ok:true,replay:false,expectedRevision:7,nextRevision:8});const x=base();x.actor={userId:'456',chatId:'456',authenticated:true,isAdmin:true};assert.equal(decideReopen(x).ok,true);});
test('other operators cannot discover or open a package',()=>{const x=base();x.actor.userId=x.actor.chatId='456';assert.deepEqual(decideReopen(x),{ok:false,reason:'NOT_FOUND'});});
test('private authenticated chat and explicit role required',()=>{for(const patch of [{authenticated:false},{chatId:'456'},{isAdmin:undefined}]){const x=base();Object.assign(x.actor,patch);assert.equal(decideReopen(x).ok,false);}});
test('active session conflicts and repeated open',()=>{const x=base();x.session.state='OTHER_PACKAGE';assert.equal(decideReopen(x).reason,'SESSION_BUSY');x.session.state='THIS_PACKAGE';x.pkg.state='OPEN';assert.deepEqual(decideReopen(x),{ok:true,replay:true});});
test('never reopen while processing or publication is uncertain',()=>{for(const patch of [{processing:{revision:7,state:'RUNNING',noActiveAttempts:false}},{processing:{revision:6,state:'TERMINAL_BLOCKED',noActiveAttempts:true}},{publication:{revision:7,verdict:'UNKNOWN'}},{publication:{revision:7,verdict:'PARTIAL'}},{publication:{revision:6,verdict:'NO_PUBLICATION_SIDE_EFFECTS_CONFIRMED'}}]){const x=Object.assign(base(),patch);assert.equal(decideReopen(x).ok,false);}});
test('cancelled and closed packages cannot reopen implicitly',()=>{for(const state of ['CANCELLED','PUBLISHED','OPEN']){const x=base();x.pkg.state=state;assert.equal(decideReopen(x).ok,false);}});
test('notice includes the package without claiming reopen has succeeded',()=>{assert.match(blockedNotice(id),new RegExp('/abrir '+id));assert.throws(()=>blockedNotice('tg_bad'));});

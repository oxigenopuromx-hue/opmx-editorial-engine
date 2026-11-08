import test from 'node:test';
import assert from 'node:assert/strict';
import {createCandidateRecoverySubsystem} from './recovery-assembly.mjs';
const pool={async getConnection(){throw Error('unexpected IO')}};
test('composition refuses to turn on without both server-owned evidence providers',()=>{
 assert.throws(()=>createCandidateRecoverySubsystem({pool,adminUserIds:['255516723'],beginLegacyTarget:async()=>{}}),/RECOVERY_CONFIGURATION_INCOMPLETE/);
 assert.throws(()=>createCandidateRecoverySubsystem({pool,adminUserIds:[],lockTrustedSafetyBarrier:async()=>{},captureTrustedRevision:async()=>{}}),/RECOVERY_CONFIGURATION_INCOMPLETE/);
});
test('composition exposes server functions but never takes policy from HTTP',()=>{
 const service=createCandidateRecoverySubsystem({pool,adminUserIds:['255516723'],lockTrustedSafetyBarrier:async()=>null,captureTrustedRevision:async()=>null,beginLegacyTarget:async()=>({status:'not_reserved'})});
 assert.deepEqual(Object.keys(service).sort(),['initializeMotorAttempt','initializePublicationFence','motorAttempts','readConfirmedCorrection','readRecoveredPolicy','targetBegin','telegramBlockedList','telegramPublicationBegin','telegramRecovery']);assert.ok(Object.isFrozen(service));
});

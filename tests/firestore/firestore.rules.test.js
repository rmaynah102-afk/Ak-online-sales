'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {initializeTestEnvironment,assertSucceeds,assertFails} = require('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,deleteDoc,writeBatch,Timestamp,serverTimestamp,collection,getDocs,query,where} = require('firebase/firestore');

const PROJECT_ID='demo-ak-sale-rules';
let testEnv;
const futureTimestamp=(hours=24)=>Timestamp.fromMillis(Date.now()+hours*60*60*1000);
function googleContext(uid,claims={}) {
 return testEnv.authenticatedContext(uid,{...claims,firebase:{...(claims.firebase||{}),sign_in_provider:'google.com'}});
}
function passwordContext(uid,claims={}) {
 return testEnv.authenticatedContext(uid,{...claims,firebase:{...(claims.firebase||{}),sign_in_provider:'password'}});
}

async function seedLicense(uid,hours=24*30){
 await testEnv.withSecurityRulesDisabled(async ctx=>{
  const adminDb=ctx.firestore();
  await setDoc(doc(adminDb,'licenses',uid),{
   uid,email:uid+'@example.com',shopName:'Test Shop',industryType:'general',
   status:'active',plan:'30-days',expiresAt:futureTimestamp(hours)
  });
 });
}
async function seedInvite(shopId,code,name='Staff Member',hours=24){
 await testEnv.withSecurityRulesDisabled(async ctx=>{
  const adminDb=ctx.firestore();
  await setDoc(doc(adminDb,'shopInvites',code),{
   shopId,role:'employee',name,status:'open',createdAt:Timestamp.now(),
   expiresAt:futureTimestamp(hours),createdBy:shopId
  });
 });
}
async function claimInvite(staffUid,email,shopId,code,slot=1,name='Staff Member'){
 const db=googleContext(staffUid,{email,email_verified:true}).firestore();
 const slotId=shopId+'_'+slot,batch=writeBatch(db);
 batch.set(doc(db,'shopMembers',staffUid),{
  shopId,role:'employee',status:'active',email,createdAt:serverTimestamp(),
  createdBy:shopId,inviteCode:code,slotId,canPrint:false,merchantStaff:true,name
 });
 batch.update(doc(db,'shopInvites',code),{
  status:'claimed',claimedBy:staffUid,claimedAt:serverTimestamp()
 });
 batch.set(doc(db,'shopStaffSlots',slotId),{
  shopId,uid:staffUid,slot,createdAt:serverTimestamp(),inviteCode:code
 });
 await batch.commit();
 return db;
}

describe('AK Sale POS Google-only authentication',function(){
 this.timeout(30000);
 before(async()=>{
  const rules=fs.readFileSync(path.join(__dirname,'..','..','firestore.rules'),'utf8');
  testEnv=await initializeTestEnvironment({projectId:PROJECT_ID,firestore:{rules}});
 });
 after(async()=>{if(testEnv)await testEnv.cleanup()});
 beforeEach(async()=>{await testEnv.clearFirestore()});
 it('rejects verified Email/Password users from Platform Owner and Shop Owner POS access',async()=>{
  await seedLicense('shop-a');
  const passwordShop=passwordContext('shop-a',{email:'shop-a@example.com',email_verified:true}).firestore();
  await assertFails(getDoc(doc(passwordShop,'licenses','shop-a')));
  await assertFails(getDoc(doc(passwordShop,'shops','shop-a','pos','products','records','p1')));
  const passwordOwner=passwordContext('owner-uid',{email:'painglin102@gmail.com',email_verified:true}).firestore();
  await assertFails(setDoc(doc(passwordOwner,'pendingOwnerInvites','bad@example.com'),{
   email:'bad@example.com',shopName:'Bad Shop',industryType:'general',status:'pending',
   invitedBy:'owner-uid',createdAt:serverTimestamp(),expiresAt:futureTimestamp()
  }));
 });
});

describe('AK Sale POS role and tenant security',function(){
 this.timeout(30000);
 before(async()=>{
  const rules=fs.readFileSync(path.join(__dirname,'..','..','firestore.rules'),'utf8');
  testEnv=await initializeTestEnvironment({projectId:PROJECT_ID,firestore:{rules}});
 });
 after(async()=>{if(testEnv)await testEnv.cleanup()});
 beforeEach(async()=>{await testEnv.clearFirestore()});

 it('allows only the verified Platform Owner to issue a Shop Owner Gmail invitation',async()=>{
  const owner=googleContext('platform-owner-uid',{email:'painglin102@gmail.com',email_verified:true}).firestore();
  const expires=futureTimestamp(24*30);
  await assertSucceeds(setDoc(doc(owner,'pendingOwnerInvites','shop@example.com'),{
   email:'shop@example.com',shopName:'AK Hardware',industryType:'hardware',status:'pending',
   invitedBy:'platform-owner-uid',createdAt:serverTimestamp(),expiresAt:expires
  }));
  const customer=googleContext('shop-a',{email:'shop-a@example.com',email_verified:true}).firestore();
  await assertFails(setDoc(doc(customer,'pendingOwnerInvites','fake@example.com'),{
   email:'fake@example.com',shopName:'Fake Shop',industryType:'general',status:'pending',
   invitedBy:'shop-a',createdAt:serverTimestamp(),expiresAt:futureTimestamp()
  }));
 });

 it('lets only the exact verified Gmail claim its Shop Owner license once',async()=>{
  const owner=googleContext('platform-owner-uid',{email:'painglin102@gmail.com',email_verified:true}).firestore();
  const expires=futureTimestamp(24*30);
  await assertSucceeds(setDoc(doc(owner,'pendingOwnerInvites','shop@example.com'),{
   email:'shop@example.com',shopName:'AK Hardware',industryType:'hardware',status:'pending',
   invitedBy:'platform-owner-uid',createdAt:serverTimestamp(),expiresAt:expires
  }));
  const wrong=googleContext('wrong-user',{email:'wrong@example.com',email_verified:true}).firestore();
  await assertFails(getDoc(doc(wrong,'pendingOwnerInvites','shop@example.com')));
  const unverified=googleContext('unverified',{email:'shop@example.com',email_verified:false}).firestore();
  await assertFails(getDoc(doc(unverified,'pendingOwnerInvites','shop@example.com')));
  const invitee=googleContext('shop-owner-uid',{email:'shop@example.com',email_verified:true}).firestore();
  const readable=await assertSucceeds(getDoc(doc(invitee,'pendingOwnerInvites','shop@example.com')));
  assert.equal(readable.data().status,'pending');
  const batch=writeBatch(invitee);
  batch.set(doc(invitee,'licenses','shop-owner-uid'),{
   uid:'shop-owner-uid',email:'shop@example.com',shopName:'AK Hardware',industryType:'hardware',
   status:'active',plan:'owner-managed',expiresAt:expires,provisionedBy:'platform-owner-uid',
   provisionedAt:serverTimestamp(),updatedAt:serverTimestamp()
  });
  batch.update(doc(invitee,'pendingOwnerInvites','shop@example.com'),{
   status:'claimed',claimedUid:'shop-owner-uid',claimedAt:serverTimestamp()
  });
  await assertSucceeds(batch.commit());
  const second=writeBatch(invitee);
  second.set(doc(invitee,'licenses','hijack-uid'),{
   uid:'hijack-uid',email:'shop@example.com',shopName:'Hijack',industryType:'general',
   status:'active',plan:'owner-managed',expiresAt:expires,provisionedBy:'platform-owner-uid',
   provisionedAt:serverTimestamp(),updatedAt:serverTimestamp()
  });
  second.update(doc(invitee,'pendingOwnerInvites','shop@example.com'),{
   status:'claimed',claimedUid:'hijack-uid',claimedAt:serverTimestamp()
  });
  await assertFails(second.commit());
 });

 it('allows a licensed Shop Owner and verified Platform Owner to create 32-character Staff invites',async()=>{
  await seedLicense('shop-a');
  const owner=googleContext('shop-a',{email:'shop-a@example.com',email_verified:true}).firestore();
  const code='ABCDEF0123456789ABCDEF0123456789';
  await assertSucceeds(setDoc(doc(owner,'shopInvites',code),{
   shopId:'shop-a',role:'employee',name:'Staff One',status:'open',
   createdAt:serverTimestamp(),expiresAt:futureTimestamp(24),createdBy:'shop-a'
  }));
  const platform=googleContext('platform-owner',{email:'painglin102@gmail.com',email_verified:true}).firestore();
  await assertSucceeds(setDoc(doc(platform,'shopInvites','FEDCBA9876543210FEDCBA9876543210'),{
   shopId:'platform-owner',role:'employee',name:'Owner Staff',status:'open',
   createdAt:serverTimestamp(),expiresAt:futureTimestamp(24),createdBy:'platform-owner'
  }));
  await assertFails(setDoc(doc(owner,'shopInvites','not-32-chars'),{
   shopId:'shop-a',role:'employee',name:'Staff Two',status:'open',
   createdAt:serverTimestamp(),expiresAt:futureTimestamp(24),createdBy:'shop-a'
  }));
 });

 it('lets a verified personal Gmail claim a one-time Staff invite and reserve one of two slots atomically',async()=>{
  await seedLicense('shop-a');
  const code='0123456789ABCDEF0123456789ABCDEF';
  await seedInvite('shop-a',code,'Staff A');
  const db=await claimInvite('staff-a','staff-a@example.com','shop-a',code,1,'Staff A');
  const member=await assertSucceeds(getDoc(doc(db,'shopMembers','staff-a')));
  assert.equal(member.data().role,'employee');
  assert.equal(member.data().merchantStaff,true);
  assert.equal(member.data().email,'staff-a@example.com');
  assert.equal(member.data().shopId,'shop-a');
  await assertSucceeds(getDoc(doc(db,'licenses','shop-a')));
  await assertSucceeds(getDoc(doc(db,'shopStaffSlots','shop-a_1')));
 });

 it('supports one Shop Owner plus exactly two linked Staff accounts per shop',async()=>{
  await seedLicense('shop-a');
  const code1='11111111111111111111111111111111';
  const code2='22222222222222222222222222222222';
  const code3='33333333333333333333333333333333';
  await seedInvite('shop-a',code1,'Staff One');
  await claimInvite('staff-one','staff-one@example.com','shop-a',code1,1,'Staff One');
  await seedInvite('shop-a',code2,'Staff Two');
  await claimInvite('staff-two','staff-two@example.com','shop-a',code2,2,'Staff Two');
  const owner=googleContext('shop-a',{email:'shop-a@example.com',email_verified:true}).firestore();
  const listed=await assertSucceeds(getDocs(query(collection(owner,'shopMembers'),where('shopId','==','shop-a'))));
  assert.equal(listed.size,2,'Shop Owner should see exactly the two Staff linked to this shop');
  await seedInvite('shop-a',code3,'Staff Three');
  for(const slot of [1,2]){
   const uid='staff-three-'+slot,email='staff-three@example.com',db=googleContext(uid,{email,email_verified:true}).firestore(),slotId='shop-a_'+slot,batch=writeBatch(db);
   batch.set(doc(db,'shopMembers',uid),{shopId:'shop-a',role:'employee',status:'active',email,createdAt:serverTimestamp(),createdBy:'shop-a',inviteCode:code3,slotId,canPrint:false,merchantStaff:true,name:'Staff Three'});
   batch.update(doc(db,'shopInvites',code3),{status:'claimed',claimedBy:uid,claimedAt:serverTimestamp()});
   batch.set(doc(db,'shopStaffSlots',slotId),{shopId:'shop-a',uid,slot,createdAt:serverTimestamp(),inviteCode:code3});
   await assertFails(batch.commit());
  }
 });
 it('rejects unverified, expired, cross-shop and reused Staff invitations',async()=>{
  await seedLicense('shop-a');
  const code='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  await seedInvite('shop-a',code);
  const unverified=googleContext('unverified-staff',{email:'staff@example.com',email_verified:false}).firestore();
  const batch=writeBatch(unverified);
  batch.set(doc(unverified,'shopMembers','unverified-staff'),{
   shopId:'shop-a',role:'employee',status:'active',email:'staff@example.com',
   createdAt:serverTimestamp(),createdBy:'shop-a',inviteCode:code,slotId:'shop-a_1',
   canPrint:false,merchantStaff:true,name:'Unverified'
  });
  batch.update(doc(unverified,'shopInvites',code),{status:'claimed',claimedBy:'unverified-staff',claimedAt:serverTimestamp()});
  batch.set(doc(unverified,'shopStaffSlots','shop-a_1'),{
   shopId:'shop-a',uid:'unverified-staff',slot:1,createdAt:serverTimestamp(),inviteCode:code
  });
  await assertFails(batch.commit());
  await claimInvite('staff-a','staff-a@example.com','shop-a',code);
  await assertFails(claimInvite('staff-b','staff-b@example.com','shop-a',code,2));
  const expired='EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';
  await seedInvite('shop-a',expired,'Expired Staff',-1);
  const other=googleContext('staff-c',{email:'staff-c@example.com',email_verified:true}).firestore();
  await assertFails(getDoc(doc(other,'shopInvites',expired)));
 });

 it('blocks Staff from editing their role, deleting their membership, or seeing cost and profit data',async()=>{
  await seedLicense('shop-a');
  await testEnv.withSecurityRulesDisabled(async ctx=>{
   const adminDb=ctx.firestore();
   await setDoc(doc(adminDb,'shops','shop-a','pos','productCosts','records','p1'),{cost:100});
   await setDoc(doc(adminDb,'shops','shop-a','pos','saleCosts','records','s1'),{cost:100,profit:50});
  });
  const code='BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
  await seedInvite('shop-a',code);
  const db=await claimInvite('staff-a','staff-a@example.com','shop-a',code);
  await assertFails(setDoc(doc(db,'shopMembers','staff-a'),{
   shopId:'shop-a',role:'manager',status:'active',email:'staff-a@example.com',
   createdAt:serverTimestamp(),createdBy:'shop-a',inviteCode:code,slotId:'shop-a_1',
   canPrint:true,merchantStaff:true,name:'Staff A'
  }));
  await assertFails(deleteDoc(doc(db,'shopMembers','staff-a')));
  await assertFails(getDoc(doc(db,'shops','shop-a','pos','productCosts','records','p1')));
  await assertFails(getDoc(doc(db,'shops','shop-a','pos','saleCosts','records','s1')));
 });

 it('allows Staff to read products and create sales, but not purchase or expense records',async()=>{
  await seedLicense('shop-a');
  const code='CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
  await seedInvite('shop-a',code);
  const db=await claimInvite('staff-a','staff-a@example.com','shop-a',code);
  await testEnv.withSecurityRulesDisabled(async ctx=>{
  const adminDb=ctx.firestore();
   await setDoc(doc(adminDb,'shops','shop-a','pos','products','records','p1'),{
    name:'Hammer',retail:5000,wholesale:4500,stock:5
   });
  });
  await assertSucceeds(getDoc(doc(db,'shops','shop-a','pos','products','records','p1')));
  await assertSucceeds(setDoc(doc(db,'shops','shop-a','pos','sales','records','s1'),{
   total:5000,paid:5000,due:0,productName:'Hammer',qty:1
  }));
  await assertFails(setDoc(doc(db,'shops','shop-a','pos','purchases','records','p1'),{total:5000}));
  await assertFails(setDoc(doc(db,'shops','shop-a','pos','expenses','records','e1'),{amount:500}));
  await assertFails(setDoc(doc(db,'shops','shop-a','pos','products','records','p1'),{
   name:'Hammer',retail:6000,wholesale:4500,stock:4
  }));
  await assertSucceeds(setDoc(doc(db,'shops','shop-a','pos','products','records','p1'),{stock:4},{merge:true}));
 });

 it('prevents cross-tenant access and blocks Staff when the Shop Owner subscription expires',async()=>{
  await seedLicense('shop-a');
  await seedLicense('shop-b');
  const code='DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
  await seedInvite('shop-a',code);
  const db=await claimInvite('staff-a','staff-a@example.com','shop-a',code);
  await assertFails(getDoc(doc(db,'shops','shop-b','pos','products','records','p1')));
  await testEnv.withSecurityRulesDisabled(async ctx=>{
  const adminDb=ctx.firestore();
   await setDoc(doc(adminDb,'licenses','shop-a'),{
    uid:'shop-a',email:'shop-a@example.com',shopName:'Test Shop',industryType:'general',
    status:'active',plan:'30-days',expiresAt:Timestamp.fromMillis(Date.now()-60000)
   });
  });
  await assertFails(getDoc(doc(db,'shops','shop-a','pos','products','records','p1')));
  await assertFails(getDoc(doc(db,'licenses','shop-a')));
 });

 it('allows Shop Owner to revoke a Staff member and release their slot',async()=>{
  await seedLicense('shop-a');
  const code='EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';
  await seedInvite('shop-a',code);
  await claimInvite('staff-a','staff-a@example.com','shop-a',code);
  const owner=googleContext('shop-a',{email:'shop-a@example.com',email_verified:true}).firestore();
  const revoke=writeBatch(owner);
  revoke.update(doc(owner,'shopMembers','staff-a'),{status:'suspended',revokedAt:serverTimestamp()});
  revoke.delete(doc(owner,'shopStaffSlots','shop-a_1'));
  await assertSucceeds(revoke.commit());
  const staff=googleContext('staff-a',{email:'staff-a@example.com',email_verified:true}).firestore();
  await assertFails(getDoc(doc(staff,'shopMembers','staff-a')));
 });

 it('does not allow legacy Manager, Cashier or synthetic staff account creation',async()=>{
  await seedLicense('shop-a');
  const owner=googleContext('shop-a',{email:'shop-a@example.com',email_verified:true}).firestore();
  await assertFails(setDoc(doc(owner,'shopInvites','FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'),{
   shopId:'shop-a',role:'manager',name:'Legacy Manager',status:'open',
   createdAt:serverTimestamp(),expiresAt:futureTimestamp(24),createdBy:'shop-a'
  }));
  await assertFails(setDoc(doc(owner,'shopInvites','99999999999999999999999999999999'),{
   shopId:'shop-a',role:'cashier',name:'Legacy Cashier',status:'open',
   createdAt:serverTimestamp(),expiresAt:futureTimestamp(24),createdBy:'shop-a'
  }));
 });
});

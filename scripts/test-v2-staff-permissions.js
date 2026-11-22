'use strict';
const fs=require('fs');
const html=fs.readFileSync('v2/index.html','utf8');
const rules=fs.readFileSync('firestore.rules','utf8');
const checks=[
 ['Staff permission defaults cover catalog, sales, customers, payments and stock',html.includes('DEFAULT_STAFF_PERMISSIONS=Object.freeze({viewProducts:true,viewSales:true,createSales:true,viewCustomers:true,manageCustomers:true,receivePayments:true,adjustStock:true})')],
 ['New Merchant Code claims receive explicit default permissions',html.includes('permissions:{...DEFAULT_STAFF_PERMISSIONS}')],
 ['Shop Owner sees individual staff permission checkboxes',html.includes('data-staff-perm=')&&html.includes('data-save-staff-permissions')&&html.includes('data-staff-can-print')],
 ['Owner save validates dependent permissions and persists permissions plus print access',html.includes('permissions.createSales&&(!permissions.viewSales||!permissions.viewProducts||!permissions.adjustStock)')&&html.includes('await ref.update({permissions,canPrint})')],
 ['Staff UI hides modules and disables actions based on permission map',html.includes('products:can("viewProducts")')&&html.includes('sales:can("viewSales")')&&html.includes('el.disabled=!saleAllowed')],
 ['Staff only sees stock edit action when stock adjustment is allowed',html.includes('staffStock=staffRole==="employee"&&staffPermissions.adjustStock===true')&&html.includes('adjustProductStock')],
 ['Receipt printing is denied unless owner enabled canPrint',html.includes('staffRole==="employee"&&!staffCanPrint')&&html.includes('staffRole==="owner"||staffCanPrint')],
 ['Firestore checks per-staff permissions for reads and writes',rules.includes('function staffHasPermission')&&rules.includes("staffHasPermission(member, 'viewProducts')")&&rules.includes("staffHasPermission(member, 'createSales')")&&rules.includes("staffHasPermission(member, 'adjustStock')")],
 ['Firestore restricts owner updates to validated permission keys',rules.includes('function validStaffPermissions')&&rules.includes("hasOnly(['canPrint','status','revokedAt','permissions'])")&&rules.includes('validStaffPermissions(request.resource.data.permissions)')],
 ['Sales viewers can read payment history but only payment-authorized staff can create payments',(()=>{const read=rules.slice(rules.indexOf('function canReadPosCollection'),rules.indexOf('function canCreatePosCollection'));const create=rules.slice(rules.indexOf('function canCreatePosCollection'),rules.indexOf('function canUpdatePosCollection'));return read.includes("collection == 'payments' && staffHasPermission(shopId, 'viewSales')")&&!read.includes("staffHasPermission(shopId, 'receivePayments')")&&create.includes("collection == 'payments' && staffHasPermission(shopId, 'receivePayments')")})()]
];
for(const [name,ok] of checks)console.log((ok?'PASS ':'FAIL ')+name);
const failed=checks.filter(([,ok])=>!ok).map(([name])=>name);
if(failed.length)throw new Error('Staff permissions validation failed: '+failed.join('; '));
console.log('Staff permission UI and Firestore contract checks passed.');
// // scripts/migrate-data.ts
// import { PrismaClient as SourcePrisma } from './prisma/client';
// import { PrismaClient as PgPrisma } from '../prisma/pg-client';

// const source = new SourcePrisma();
// const target = new PgPrisma();

// async function main() {
// 	// Copy Vendors
// 	{
// 		const rows = await source.vendor.findMany();
// 		console.log(`Vendors: ${rows.length}`);
// 		for (const r of rows) {
// 			await target.vendor.upsert({
// 				where: { vendorId: r.vendorId },
// 				create: {
// 					id: r.id, // keep IDs if same type (String/cuid)
// 					vendorId: r.vendorId,
// 					tpaName: r.tpaName,
// 					insuranceName: r.insuranceName,
// 					address: r.address,
// 					phone: r.phone,
// 					isActive: r.isActive,
// 					createdAt: r.createdAt,
// 					updatedAt: r.updatedAt,
// 				},
// 				update: {
// 					tpaName: r.tpaName,
// 					insuranceName: r.insuranceName,
// 					address: r.address,
// 					phone: r.phone,
// 					isActive: r.isActive,
// 					updatedAt: r.updatedAt,
// 				},
// 			});
// 		}
// 	}

// 	// Copy InsuranceCompanies
// 	{
// 		const rows = await source.insuranceCompany.findMany();
// 		console.log(`InsuranceCompany: ${rows.length}`);
// 		for (const r of rows) {
// 			await target.insuranceCompany.upsert({
// 				where: { vendorId_name: { vendorId: r.vendorId, name: r.name } },
// 				create: {
// 					id: r.id,
// 					vendorId: r.vendorId,
// 					name: r.name,
// 					code: r.code,
// 					isActive: r.isActive,
// 					createdAt: r.createdAt,
// 					updatedAt: r.updatedAt,
// 				},
// 				update: {
// 					code: r.code,
// 					isActive: r.isActive,
// 					updatedAt: r.updatedAt,
// 				},
// 			});
// 		}
// 	}

// 	// Copy Labs
// 	{
// 		const rows = await source.lab.findMany();
// 		console.log(`Labs: ${rows.length}`);
// 		for (const r of rows) {
// 			await target.lab.upsert({
// 				where: { labCode: r.labCode },
// 				create: {
// 					id: r.id,
// 					labCode: r.labCode,
// 					name: r.name,
// 					address: r.address,
// 					phone: r.phone,
// 					isActive: r.isActive,
// 					createdAt: r.createdAt,
// 					updatedAt: r.updatedAt,
// 				},
// 				update: {
// 					name: r.name,
// 					address: r.address,
// 					phone: r.phone,
// 					isActive: r.isActive,
// 					updatedAt: r.updatedAt,
// 				},
// 			});
// 		}
// 	}

// 	// Copy Appointments (resolve foreign keys by id, since we preserved ids)
// 	{
// 		const rows = await source.appointment.findMany();
// 		console.log(`Appointments: ${rows.length}`);
// 		for (const r of rows) {
// 			await target.appointment.upsert({
// 				where: { id: r.id },
// 				create: {
// 					id: r.id,
// 					apptAt: r.apptAt,
// 					vendorId: r.vendorId,
// 					insuranceCompanyId: r.insuranceCompanyId,
// 					labId: r.labId,
// 					clientName: r.clientName,
// 					clientRef: r.clientRef,
// 					gender: r.gender,
// 					age: r.age,
// 					address: r.address,
// 					phone: r.phone,
// 					visitType: r.visitType,
// 					location: r.location,
// 					status: (r as any).status ?? r.medicalStatus ?? null, // unify if you renamed
// 					extraChargeRs: r.extraChargeRs,
// 					paymentStatus: r.paymentStatus,
// 					isActive: r.isActive,
// 					createdAt: r.createdAt,
// 					updatedAt: r.updatedAt,
// 				},
// 				update: {
// 					apptAt: r.apptAt,
// 					vendorId: r.vendorId,
// 					insuranceCompanyId: r.insuranceCompanyId,
// 					labId: r.labId,
// 					clientName: r.clientName,
// 					clientRef: r.clientRef,
// 					gender: r.gender,
// 					age: r.age,
// 					address: r.address,
// 					phone: r.phone,
// 					visitType: r.visitType,
// 					location: r.location,
// 					status: (r as any).status ?? r.medicalStatus ?? null,
// 					extraChargeRs: r.extraChargeRs,
// 					paymentStatus: r.paymentStatus,
// 					isActive: r.isActive,
// 					updatedAt: r.updatedAt,
// 				},
// 			});
// 		}
// 	}

// 	console.log('✅ Data copy complete');
// }

// main()
// 	.catch((e) => { console.error(e); process.exit(1); })
// 	.finally(async () => {
// 		await source.$disconnect();
// 		await target.$disconnect();
// 	});

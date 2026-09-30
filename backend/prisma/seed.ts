import {
  PrismaClient,
  Role,
  MedicineCategory,
  MedicineUnit,
  StaffRole,
  MedicineEventReason,
  FootfallEventSource,
  BedEventReason,
  User,
  Phc,
  Medicine,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const prisma = new PrismaClient();

// ---------- helpers ----------
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pickWeighted<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it.value;
  }
  return items[items.length - 1].value;
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(rand(6, 22), rand(0, 59), rand(0, 59), 0);
  return d;
}

// ---------- PHCs ----------
const PHC_DATA = [
  { name: 'South Delhi - Saket PHC',         city: 'Delhi',    zone: 'South',    pop: 85000, beds: 30, staff: 22, lat: 28.5244, lng: 77.2066, phcShort: 'SAK' },
  { name: 'West Delhi - Janakpuri PHC',      city: 'Delhi',    zone: 'West',     pop: 72000, beds: 25, staff: 18, lat: 28.6199, lng: 77.0855, phcShort: 'JAN' },
  { name: 'Noida - Sector 22 PHC',           city: 'Noida',    zone: 'East',     pop: 95000, beds: 35, staff: 24, lat: 28.5756, lng: 77.3568, phcShort: 'NOI' },
  { name: 'Gurugram - Sector 31 PHC',        city: 'Gurugram', zone: 'South',    pop: 78000, beds: 28, staff: 20, lat: 28.4601, lng: 77.0672, phcShort: 'GGN' },
  { name: 'Ghaziabad - Vasundhara PHC',      city: 'Ghaziabad',zone: 'North-East',pop: 88000, beds: 32, staff: 22, lat: 28.6654, lng: 77.3852, phcShort: 'GZB' },
];
// indices used later: SAKET=0, JANAK=1, NOIDA=2, GURUGRAM=3 (surplus), GHAZIABAD=4

// ---------- medicine catalogue ----------
interface MedSeed { name: string; generic?: string; cat: MedicineCategory; unit: MedicineUnit; dailyPer100: number; reorder: number; critical: number; }
const MEDS: MedSeed[] = [
  { name: 'Paracetamol 500mg',            generic: 'Acetaminophen',        cat: MedicineCategory.Antipyretic,  unit: MedicineUnit.Tablet, dailyPer100: 18,  reorder: 500, critical: 150 },
  { name: 'ORS Sachets',                  generic: 'Oral Rehydration',     cat: MedicineCategory.Fluid,        unit: MedicineUnit.Strip,  dailyPer100: 12,  reorder: 400, critical: 120 },
  { name: 'Doxycycline 100mg',             generic: 'Doxycycline',          cat: MedicineCategory.Antibiotic,   unit: MedicineUnit.Tablet, dailyPer100: 4,   reorder: 200, critical: 60  },
  { name: 'Platelet Transfusion Kit',     generic: 'Platelet Kit',         cat: MedicineCategory.Kits,         unit: MedicineUnit.Kit,    dailyPer100: 0.3, reorder: 30,  critical: 10  },
  { name: 'Amoxicillin 250mg',             generic: 'Amoxicillin',          cat: MedicineCategory.Antibiotic,   unit: MedicineUnit.Tablet, dailyPer100: 9,   reorder: 400, critical: 120 },
  { name: 'Azithromycin 500mg',            generic: 'Azithromycin',         cat: MedicineCategory.Antibiotic,   unit: MedicineUnit.Tablet, dailyPer100: 4,   reorder: 150, critical: 40  },
  { name: 'Ciprofloxacin 500mg',           generic: 'Ciprofloxacin',        cat: MedicineCategory.Antibiotic,   unit: MedicineUnit.Tablet, dailyPer100: 3,   reorder: 150, critical: 40  },
  { name: 'Metformin 500mg',               generic: 'Metformin',            cat: MedicineCategory.Cardiac,      unit: MedicineUnit.Tablet, dailyPer100: 10,  reorder: 500, critical: 150 },
  { name: 'Amlodipine 5mg',                generic: 'Amlodipine',           cat: MedicineCategory.Cardiac,      unit: MedicineUnit.Tablet, dailyPer100: 8,   reorder: 400, critical: 120 },
  { name: 'Aspirin 75mg',                  generic: 'Aspirin',              cat: MedicineCategory.Cardiac,      unit: MedicineUnit.Tablet, dailyPer100: 9,   reorder: 400, critical: 120 },
  { name: 'Salbutamol Inhaler',            generic: 'Albuterol',            cat: MedicineCategory.Respiratory,  unit: MedicineUnit.Injection,dailyPer100: 0.8,reorder: 60,  critical: 20  },
  { name: 'Budesonide 200mcg Inhaler',     generic: 'Budesonide',           cat: MedicineCategory.Respiratory,  unit: MedicineUnit.Injection,dailyPer100: 0.4,reorder: 40,  critical: 12  },
  { name: 'Cetirizine 10mg',               generic: 'Cetirizine',           cat: MedicineCategory.Respiratory,  unit: MedicineUnit.Tablet, dailyPer100: 5,   reorder: 300, critical: 90  },
  { name: 'Omeprazole 20mg',               generic: 'Omeprazole',           cat: MedicineCategory.Other,        unit: MedicineUnit.Tablet, dailyPer100: 8,   reorder: 400, critical: 120 },
  { name: 'Ibuprofen 400mg',               generic: 'Ibuprofen',            cat: MedicineCategory.Antipyretic,  unit: MedicineUnit.Tablet, dailyPer100: 6,   reorder: 300, critical: 90  },
  { name: 'Metronidazole 400mg',           generic: 'Metronidazole',        cat: MedicineCategory.Antibiotic,   unit: MedicineUnit.Tablet, dailyPer100: 3,   reorder: 200, critical: 60  },
  { name: 'Chloroquine 250mg',             generic: 'Chloroquine',          cat: MedicineCategory.Antimalarial, unit: MedicineUnit.Tablet, dailyPer100: 0.5, reorder: 100, critical: 30  },
  { name: 'Artemether-Lumefantrine Kit',   generic: 'ACT',                  cat: MedicineCategory.Antimalarial, unit: MedicineUnit.Kit,    dailyPer100: 0.4, reorder: 60,  critical: 20  },
  { name: 'Dextrose 5% 500ml',             generic: 'D5 IV',                cat: MedicineCategory.Fluid,        unit: MedicineUnit.Bottle, dailyPer100: 3,   reorder: 120, critical: 40  },
  { name: 'Normal Saline 500ml',           generic: 'NS IV',                cat: MedicineCategory.Fluid,        unit: MedicineUnit.Bottle, dailyPer100: 4,   reorder: 150, critical: 50  },
  { name: 'Vitamin B-Complex',             generic: 'B-Complex',            cat: MedicineCategory.Other,        unit: MedicineUnit.Tablet, dailyPer100: 6,   reorder: 300, critical: 100 },
  { name: 'Vitamin C 500mg',               generic: 'Ascorbic Acid',        cat: MedicineCategory.Other,        unit: MedicineUnit.Tablet, dailyPer100: 7,   reorder: 300, critical: 100 },
  { name: 'Moxifloxacin Eye Drops',        generic: 'Moxifloxacin',         cat: MedicineCategory.Ophthalmic,   unit: MedicineUnit.Bottle, dailyPer100: 0.3, reorder: 30,  critical: 10  },
  { name: 'Tetanus Toxoid Vaccine',        generic: 'TT',                   cat: MedicineCategory.Vaccine,      unit: MedicineUnit.Injection,dailyPer100: 0.6,reorder: 80,  critical: 25  },
  { name: 'DPT Booster Vaccine',           generic: 'DPT',                  cat: MedicineCategory.Vaccine,      unit: MedicineUnit.Injection,dailyPer100: 0.4,reorder: 60,  critical: 20  },
];

// ---------- seed ----------
async function main() {
  const salt = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
  const adminPw = await bcrypt.hash('admin123', salt);

  console.log('Seeding PHCs, Users, Medicines...');

  const phcs: Phc[] = [];
  for (const p of PHC_DATA) {
    const phc = await prisma.phc.create({
      data: {
        name: p.name,
        city: p.city,
        zone: p.zone,
        catchmentPopulation: p.pop,
        totalBeds: p.beds,
        totalStaff: p.staff,
        lat: p.lat,
        lng: p.lng,
      },
    });
    phcs.push(phc);
  }
  const SAKET = phcs[0].id, JANAK = phcs[1].id, NOIDA = phcs[2].id, GGN = phcs[3].id, GZB = phcs[4].id;

  // users
  const staffPws: Record<string, string> = {
    phc1_staff: 'phc1pass',
    phc2_staff: 'phc2pass',
    phc3_staff: 'phc3pass',
    phc4_staff: 'phc4pass',
    phc5_staff: 'phc5pass',
  };
  const users: User[] = [];
  users.push(
    await prisma.user.create({ data: { username: 'admin', passwordHash: adminPw, role: Role.admin, displayName: 'Administrator' } })
  );
  for (let i = 0; i < 5; i++) {
    const uname = `phc${i + 1}_staff`;
    users.push(
      await prisma.user.create({
        data: {
          username: uname,
          passwordHash: await bcrypt.hash(staffPws[uname], salt),
          role: Role.phc_staff,
          phcId: phcs[i].id,
          displayName: `${PHC_DATA[i].phcShort} Staff`,
        },
      })
    );
  }
  const adminUser = users[0];
  const staffUsers = users.slice(1);

  // medicines
  const medicines: Medicine[] = [];
  for (const m of MEDS) {
    medicines.push(
      await prisma.medicine.create({
        data: {
          name: m.name,
          genericName: m.generic,
          category: m.cat,
          unit: m.unit,
          defaultDailyConsumptionPer100Patients: m.dailyPer100,
          reorderLevel: m.reorder,
          criticalLevel: m.critical,
          daysOfStockWarning: 7,
        },
      })
    );
  }

  // baseline stock multiplier per PHC: deterministic tiers produce realistic cross-PHC spread (1 CRITICAL / 1 WARNING / 1 ABUNDANT / 2 NORMAL)
  function stockMultiplier(phcIdx: number, medIdx: number): number {
    const dengueIndices = [0, 1, 2, 3]; // Paracetamol, ORS, Doxy, Platelet
    // Per-PHC global tier:
    //   0 (SAKET)     — critical: widespread low stock, esp dengue meds extremely low
    //   1 (JAN)       — normal: 1.0-1.3 baseline
    //   2 (NOIDA)     — warning: low on dengue meds, other meds borderline
    //   3 (GGN)       — abundant: 2.1x surplus on dengue meds, everything else high
    //   4 (GZB)       — normal: steady stock
    if (dengueIndices.includes(medIdx)) {
      switch (phcIdx) {
        case 0: return 0.18; // SAKET dengue meds EXTREMELY low -> triggers CRITICAL stock alerts
        case 2: return 0.42; // NOIDA warning on dengue
        case 3: return 2.4;  // GGN donor heavy surplus
        case 1: return 0.95;
        case 4: return 1.05;
      }
    }
    switch (phcIdx) {
      case 0: return 0.42;  // SAKET non-dengue still below par → poor overall stockHealth
      case 2: return 0.72;  // NOIDA warning-tier
      case 3: return 1.7;   // GGN donor: non-dengue still generous
      case 1: return 1.05;  // JAN normal
      case 4: return 1.0;   // GZB normal
    }
    return 1.0;
  }

  console.log('Seeding medicine_inventories, phc_status, staff_roster, daily aggregates...');
  // inventories
  for (let pi = 0; pi < phcs.length; pi++) {
    const p = phcs[pi];
    for (let mi = 0; mi < medicines.length; mi++) {
      const m = medicines[mi];
      // Target 30 days of stock at baseline catchment * daily per 100
      const baselineDaily = (p.catchmentPopulation / 1000) * (m.defaultDailyConsumptionPer100Patients / 100);
      const qty = Math.max(10, Math.round(baselineDaily * 30 * stockMultiplier(pi, mi)));
      await prisma.medicineInventory.create({
        data: { phcId: p.id, medicineId: m.id, currentQuantity: qty },
      });
    }
    // phc_status — deterministic per-PHC tiers to ensure realistic map spread
    //   0 SAKET:  CRITICAL — emergency ON, beds 91% occ, staff 65% on-duty (understaffed)
    //   1 JAN:    NORMAL   — beds 58% occ,       staff 83% on-duty
    //   2 NOIDA:  WARNING  — beds 78% occ,       staff 71% on-duty (footfall surge → slight shortage)
    //   3 GGN:    ABUNDANT — beds 32% occ,       staff 93% on-duty (overstaffed, donor candidate)
    //   4 GZB:    NORMAL   — beds 54% occ,       staff 87% on-duty
    const tierOccupiedPct  = [0.91, 0.58, 0.78, 0.32, 0.54];
    const tierOnDutyPct    = [0.65, 0.83, 0.71, 0.93, 0.87];
    const tierEmergency    = [true, false, false, false, false];
    const occupied = Math.floor(PHC_DATA[pi].beds * tierOccupiedPct[pi]);
    const onDuty   = Math.floor(PHC_DATA[pi].staff * tierOnDutyPct[pi]);
    await prisma.phcStatus.create({
      data: {
        phcId: p.id,
        bedsTotal: PHC_DATA[pi].beds,
        bedsOccupied: occupied,
        bedsEmergencyReserved: Math.max(2, Math.floor(PHC_DATA[pi].beds * 0.1)),
        staffTotal: PHC_DATA[pi].staff,
        staffOnDuty: onDuty,
        activeEmergency: tierEmergency[pi],
        lastPatientCount: tierEmergency[pi] ? 18 : pi === 2 ? 11 : 4,
      },
    });
    // staff roster: 60% Nurses, 15% Docs, 10% Pharmacist, 8% LabTech, 7% Admin/Support
    const roles: { role: StaffRole; frac: number }[] = [
      { role: StaffRole.Doctor, frac: 0.14 },
      { role: StaffRole.Nurse, frac: 0.58 },
      { role: StaffRole.Pharmacist, frac: 0.10 },
      { role: StaffRole.LabTech, frac: 0.09 },
      { role: StaffRole.Admin, frac: 0.05 },
      { role: StaffRole.Support, frac: 0.04 },
    ];
    let remaining = PHC_DATA[pi].staff;
    let created = 0;
    for (let r = 0; r < roles.length; r++) {
      const count = r === roles.length - 1
        ? remaining
        : Math.max(1, Math.round(PHC_DATA[pi].staff * roles[r].frac));
      for (let k = 0; k < count; k++) {
        created++;
        await prisma.staffRoster.create({
          data: {
            phcId: p.id,
            staffMemberName: `${PHC_DATA[pi].phcShort}-${roles[r].role}-${String(k + 1).padStart(2, '0')}`,
            staffRole: roles[r].role,
            // Match tiered attendance: SAKET understaffed ~62% present, GGN abundant ~98% present, rest ~84-90%
            isPresent: Math.random() > [0.38, 0.17, 0.29, 0.05, 0.12][pi],
            lastMarked: new Date(),
          },
        });
      }
      remaining -= count;
      if (remaining <= 0) break;
    }
    // daily footfall today row
    await prisma.dailyFootfallAggregate.create({
      data: { phcId: p.id, date: new Date(new Date().toDateString()) },
    });
  }

  console.log('Generating 30 days of historical events...');
  // 30 days of history: for each day & PHC, generate footfall events, consumption events, bed events, occasional attendance.
  const DAYS = 30;
  for (let day = DAYS; day >= 1; day--) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    const dateMid = new Date(date);
    dateMid.setHours(12, 0, 0, 0);
    const todayAggPromises: any[] = [];
    for (let pi = 0; pi < phcs.length; pi++) {
      const p = phcs[pi];
      // daily footfall — NOIDA +2.2x surge to simulate dengue wave forecast
      const footfallMult = [1.0, 1.0, 2.2, 0.75, 0.95][pi];
      const base = Math.round((p.catchmentPopulation / 4500) + rand(5, 15));
      const outp = Math.max(3, Math.round(base * (0.7 + Math.random() * 0.8) * footfallMult));
      const admissions = Math.max(0, Math.round(outp * 0.08 + (Math.random() - 0.5)));
      const discharges = Math.max(0, admissions + rand(-2, 2));
      const mild = Math.round(outp * 0.7);
      const mod = Math.round(outp * 0.22);
      const sev = Math.max(0, outp - mild - mod);
      await prisma.footfallEvent.create({
        data: {
          phcId: p.id,
          outpatientDelta: outp,
          admissionsDelta: admissions,
          dischargesDelta: discharges,
          triageMildDelta: mild,
          triageModerateDelta: mod,
          triageSevereDelta: sev,
          source: FootfallEventSource.simulation,
          createdAt: dateMid,
        },
      });
      // daily aggregate
      await prisma.dailyFootfallAggregate.upsert({
        where: { phcId_date: { phcId: p.id, date: new Date(date.toDateString()) } },
        create: {
          phcId: p.id,
          date: new Date(date.toDateString()),
          outpatient: outp,
          admissions,
          discharges,
          triageMild: mild,
          triageModerate: mod,
          triageSevere: sev,
        },
        update: {
          outpatient: { increment: outp },
          admissions: { increment: admissions },
          discharges: { increment: discharges },
          triageMild: { increment: mild },
          triageModerate: { increment: mod },
          triageSevere: { increment: sev },
        },
      });
      // bed events (net around the day's delta): admissions +, discharges -
      if (admissions - discharges !== 0) {
        await prisma.bedEvent.create({
          data: {
            phcId: p.id,
            occupiedDelta: admissions - discharges,
            reason: BedEventReason.admission,
            createdAt: dateMid,
          },
        });
      }
      // medicine consumption for the day: weighted pick of ~10 different meds per day, scaled to outpatients
      const picks = pickWeightedIndices(medicines.length, 12);
      for (const mi of picks) {
        const m = medicines[mi];
        // daily rate: outpatients * defaultPer100 / 100 * jitter
        const rate = Math.max(
          0,
          Math.round((outp * m.defaultDailyConsumptionPer100Patients) / 100 * (0.5 + Math.random()))
        );
        if (rate === 0) continue;
        await prisma.medicineEvent.create({
          data: {
            phcId: p.id,
            medicineId: m.id,
            changeQty: -rate,
            reason: MedicineEventReason.dispensed,
            createdAt: new Date(dateMid.getTime() + rand(0, 6 * 3600 * 1000)),
          },
        });
      }
      // occasional attendance event: 15% chance per day of a roster toggle
      if (Math.random() < 0.18) {
        const anyRoster = await prisma.staffRoster.findFirst({
          where: { phcId: p.id },
          orderBy: { id: 'asc' },
          skip: rand(0, PHC_DATA[pi].staff - 1),
        });
        if (anyRoster) {
          await prisma.attendanceEvent.create({
            data: {
              phcId: p.id,
              staffRosterId: anyRoster.id,
              isPresent: !anyRoster.isPresent,
              operatorId: staffUsers[pi].id,
              createdAt: new Date(dateMid.getTime() - 3600_000),
            },
          });
          await prisma.staffRoster.update({
            where: { id: anyRoster.id },
            data: { isPresent: !anyRoster.isPresent },
          });
        }
      }
    }
    await Promise.all(todayAggPromises);
  }

  // Recompute phc_status staffOnDuty counts from roster (since seed toggled some)
  for (let pi = 0; pi < phcs.length; pi++) {
    const p = phcs[pi];
    const staffCount = await prisma.staffRoster.count({ where: { phcId: p.id, isPresent: true } });
    await prisma.phcStatus.updateMany({
      where: { phcId: p.id },
      data: { staffOnDuty: Math.min(PHC_DATA[pi].staff, staffCount) },
    });
  }

  // Seed a couple of starter alerts (informational) so dashboard feed is non-empty.
  await prisma.alert.createMany({
    data: [
      { phcId: SAKET,  type: 'staff_shortage', severity: 'warning',  message: 'SAKET PHC reports 2 staff on leave today.' },
      { phcId: GGN,    type: 'stockout',       severity: 'info',     message: 'GGN PHC Paracetamol stock near surplus — candidate donor.', dismissed: true },
      { phcId: NOIDA,  type: 'bed_crowding',   severity: 'warning',  message: 'NOIDA bed occupancy trending above 78%.' },
    ],
  });

  console.log(`\nSeed done.`);
  console.log(`Credentials:`);
  console.log(`  admin / admin123`);
  for (let i = 0; i < 5; i++) {
    console.log(`  phc${i + 1}_staff / phc${i + 1}pass  (-> ${PHC_DATA[i].name})`);
  }
  console.log(`PHC IDs   = [${phcs.map(p => p.id).join(', ')}]`);
  console.log(`Admin UID = ${adminUser.id}`);
}

function pickWeightedIndices(total: number, n: number): number[] {
  // weighted toward common meds (index 0..8 highest weight)
  const result: number[] = [];
  const used = new Set<number>();
  let attempts = 0;
  while (result.length < n && attempts < n * 20) {
    attempts++;
    const idx = Math.floor(Math.pow(Math.random(), 1.6) * total); // bias low
    if (!used.has(idx)) {
      used.add(idx);
      result.push(idx);
    }
  }
  return result;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

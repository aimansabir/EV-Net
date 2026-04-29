import { calculateEnergyFees, VEHICLE_SIZES } from './feeConfig.js';

function test() {
  console.log("--- PRICING TEST: SMALL @ 50 PKR/kWh ---");
  const small = calculateEnergyFees(VEHICLE_SIZES.SMALL, 50);
  console.log(small);
  // Expect: 40 * 50 = 2000
  // Service Fee: 2000 * 0.15 = 300
  // Host Fee: 2000 * 0.22 = 440
  // Gateway: 2000 * 0.03 = 60
  // User Total: 2000 + 300 = 2300
  // Host Payout: 2000 - 440 = 1560
  // Gross Rev: 300 + 440 = 740
  // Net Rev: 740 - 60 = 680
  
  const ok = small.baseCharge === 2000 && 
             small.userServiceFee === 300 && 
             small.hostPlatformFee === 440 &&
             small.gatewayCost === 60 &&
             small.userTotal === 2300 &&
             small.hostPayout === 1560 &&
             small.platformGrossRevenue === 740 &&
             small.platformNetRevenue === 680;
             
  console.log(ok ? "✅ SUCCESS" : "❌ FAILURE");

  console.log("\n--- PRICING TEST: MEDIUM @ 45 PKR/kWh ---");
  const med = calculateEnergyFees(VEHICLE_SIZES.MEDIUM, 45);
  console.log(med);
  // 60 * 45 = 2700
  
  console.log("\n--- PRICING TEST: LARGE @ 60.5 PKR/kWh (Rounding) ---");
  const large = calculateEnergyFees(VEHICLE_SIZES.LARGE, 60.5);
  console.log(large);
  // 80 * 60.5 = 4840
}

try {
  test();
} catch (e) {
  console.error("Test Error:", e.message);
}

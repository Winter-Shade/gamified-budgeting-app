const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CommitmentSavings", function () {
  let contract, owner, user, feeCollector;
  const ONE_ETH = ethers.parseEther("1.0");
  const HALF_ETH = ethers.parseEther("0.5");
  const DAILY = 1;
  const WEEKLY = 7;
  const MATURITY_30_DAYS = 30;
  const PENALTY_10_PERCENT = 1000; // basis points

  beforeEach(async function () {
    [owner, user, feeCollector] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CommitmentSavings");
    contract = await Factory.deploy(feeCollector.address);
    await contract.waitForDeployment();
  });

  describe("Plan Creation", function () {
    it("should create a plan with correct parameters", async function () {
      const tx = await contract.connect(user).createPlan(
        ONE_ETH, DAILY, MATURITY_30_DAYS, PENALTY_10_PERCENT
      );
      const receipt = await tx.wait();

      const plan = await contract.plans(0);
      expect(plan.owner).to.equal(user.address);
      expect(plan.depositAmount).to.equal(ONE_ETH);
      expect(plan.intervalDays).to.equal(DAILY);
      expect(plan.penaltyBps).to.equal(PENALTY_10_PERCENT);
      expect(plan.termsAccepted).to.be.true;
      expect(plan.closed).to.be.false;
    });

    it("should emit PlanCreated event", async function () {
      await expect(
        contract.connect(user).createPlan(ONE_ETH, WEEKLY, MATURITY_30_DAYS, PENALTY_10_PERCENT)
      ).to.emit(contract, "PlanCreated");
    });

    it("should track user plans", async function () {
      await contract.connect(user).createPlan(ONE_ETH, DAILY, MATURITY_30_DAYS, PENALTY_10_PERCENT);
      await contract.connect(user).createPlan(HALF_ETH, WEEKLY, 60, 500);
      const plans = await contract.getUserPlans(user.address);
      expect(plans.length).to.equal(2);
    });

    it("should reject zero deposit amount", async function () {
      await expect(
        contract.connect(user).createPlan(0, DAILY, MATURITY_30_DAYS, PENALTY_10_PERCENT)
      ).to.be.revertedWith("Deposit amount must be > 0");
    });

    it("should reject penalty over 50%", async function () {
      await expect(
        contract.connect(user).createPlan(ONE_ETH, DAILY, MATURITY_30_DAYS, 5001)
      ).to.be.revertedWith("Penalty cannot exceed 50%");
    });
  });

  describe("Deposits", function () {
    beforeEach(async function () {
      await contract.connect(user).createPlan(ONE_ETH, DAILY, MATURITY_30_DAYS, PENALTY_10_PERCENT);
    });

    it("should accept deposits", async function () {
      await contract.connect(user).deposit(0, { value: ONE_ETH });
      expect(await contract.getPlanBalance(0)).to.equal(ONE_ETH);
    });

    it("should accept multiple deposits", async function () {
      await contract.connect(user).deposit(0, { value: ONE_ETH });
      await contract.connect(user).deposit(0, { value: HALF_ETH });
      expect(await contract.getPlanBalance(0)).to.equal(ONE_ETH + HALF_ETH);
    });

    it("should emit Deposited event", async function () {
      await expect(
        contract.connect(user).deposit(0, { value: ONE_ETH })
      ).to.emit(contract, "Deposited").withArgs(0, user.address, ONE_ETH);
    });

    it("should reject deposits from non-owner", async function () {
      await expect(
        contract.connect(owner).deposit(0, { value: ONE_ETH })
      ).to.be.revertedWith("Not plan owner");
    });

    it("should reject zero deposits", async function () {
      await expect(
        contract.connect(user).deposit(0, { value: 0 })
      ).to.be.revertedWith("Must send ETH");
    });
  });

  describe("Withdrawal after maturity (no penalty)", function () {
    beforeEach(async function () {
      await contract.connect(user).createPlan(ONE_ETH, DAILY, MATURITY_30_DAYS, PENALTY_10_PERCENT);
      await contract.connect(user).deposit(0, { value: ONE_ETH });
    });

    it("should allow full withdrawal after maturity", async function () {
      await time.increase(31 * 24 * 60 * 60); // 31 days

      const balanceBefore = await ethers.provider.getBalance(user.address);
      const tx = await contract.connect(user).withdraw(0);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(user.address);

      expect(balanceAfter + gasCost - balanceBefore).to.equal(ONE_ETH);
    });

    it("should close the plan after withdrawal", async function () {
      await time.increase(31 * 24 * 60 * 60);
      await contract.connect(user).withdraw(0);
      const plan = await contract.plans(0);
      expect(plan.closed).to.be.true;
    });

    it("should report matured correctly", async function () {
      expect(await contract.isMatured(0)).to.be.false;
      await time.increase(31 * 24 * 60 * 60);
      expect(await contract.isMatured(0)).to.be.true;
    });
  });

  describe("Early withdrawal (with penalty)", function () {
    beforeEach(async function () {
      await contract.connect(user).createPlan(ONE_ETH, DAILY, MATURITY_30_DAYS, PENALTY_10_PERCENT);
      await contract.connect(user).deposit(0, { value: ONE_ETH });
    });

    it("should deduct 10% penalty on early withdrawal", async function () {
      const feeBalanceBefore = await ethers.provider.getBalance(feeCollector.address);
      const userBalanceBefore = await ethers.provider.getBalance(user.address);

      const tx = await contract.connect(user).withdraw(0);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const feeBalanceAfter = await ethers.provider.getBalance(feeCollector.address);
      const userBalanceAfter = await ethers.provider.getBalance(user.address);

      const expectedPenalty = ONE_ETH / 10n; // 10%
      const expectedPayout = ONE_ETH - expectedPenalty;

      expect(feeBalanceAfter - feeBalanceBefore).to.equal(expectedPenalty);
      expect(userBalanceAfter + gasCost - userBalanceBefore).to.equal(expectedPayout);
    });

    it("should emit Withdrawn event with penalty", async function () {
      const expectedPenalty = ONE_ETH / 10n;
      const expectedPayout = ONE_ETH - expectedPenalty;

      await expect(contract.connect(user).withdraw(0))
        .to.emit(contract, "Withdrawn")
        .withArgs(0, user.address, expectedPayout, expectedPenalty);
    });

    it("should calculate penalty correctly", async function () {
      const penalty = await contract.calculatePenalty(0);
      expect(penalty).to.equal(ONE_ETH / 10n);
    });

    it("should return zero penalty after maturity", async function () {
      await time.increase(31 * 24 * 60 * 60);
      const penalty = await contract.calculatePenalty(0);
      expect(penalty).to.equal(0);
    });
  });

  describe("Edge cases", function () {
    it("should not allow withdrawal on closed plan", async function () {
      await contract.connect(user).createPlan(ONE_ETH, DAILY, MATURITY_30_DAYS, PENALTY_10_PERCENT);
      await contract.connect(user).deposit(0, { value: ONE_ETH });
      await contract.connect(user).withdraw(0);

      await expect(
        contract.connect(user).withdraw(0)
      ).to.be.revertedWith("Plan is closed");
    });

    it("should not allow deposit on closed plan", async function () {
      await contract.connect(user).createPlan(ONE_ETH, DAILY, MATURITY_30_DAYS, PENALTY_10_PERCENT);
      await contract.connect(user).deposit(0, { value: ONE_ETH });
      await contract.connect(user).withdraw(0);

      await expect(
        contract.connect(user).deposit(0, { value: ONE_ETH })
      ).to.be.revertedWith("Plan is closed");
    });

    it("should allow only contract owner to change fee collector", async function () {
      await expect(
        contract.connect(user).setFeeCollector(user.address)
      ).to.be.revertedWith("Not contract owner");

      await contract.connect(owner).setFeeCollector(user.address);
      expect(await contract.feeCollector()).to.equal(user.address);
    });
  });
});

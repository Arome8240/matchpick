import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { MatchPickVault, MockERC20 } from "../typechain-types";

const parse = (n: string) => ethers.parseUnits(n, 18);

describe("MatchPickVault", () => {
  let vault: MatchPickVault;
  let cUSD: MockERC20;
  let admin: HardhatEthersSigner;
  let settler: HardhatEthersSigner;
  let sponsor: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  beforeEach(async () => {
    [admin, settler, sponsor, alice, bob, stranger] = await ethers.getSigners();

    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    cUSD = (await MockERC20Factory.deploy("Mock cUSD", "mCUSD")) as unknown as MockERC20;
    await cUSD.waitForDeployment();

    const VaultFactory = await ethers.getContractFactory("MatchPickVault");
    vault = (await upgrades.deployProxy(
      VaultFactory,
      [await cUSD.getAddress(), admin.address, settler.address],
      { kind: "uups" }
    )) as unknown as MatchPickVault;
    await vault.waitForDeployment();

    await cUSD.mint(sponsor.address, parse("1000"));
    await cUSD.connect(sponsor).approve(await vault.getAddress(), ethers.MaxUint256);
  });

  describe("initialize", () => {
    it("grants roles and sets the token", async () => {
      expect(await vault.hasRole(ethers.ZeroHash, admin.address)).to.equal(true);
      expect(await vault.hasRole(await vault.SETTLER_ROLE(), settler.address)).to.equal(true);
      expect(await vault.cUSD()).to.equal(await cUSD.getAddress());
    });

    it("cannot be initialized twice", async () => {
      await expect(
        vault.initialize(await cUSD.getAddress(), admin.address, settler.address)
      ).to.be.revertedWithCustomError(vault, "InvalidInitialization");
    });

    it("rejects zero addresses at deploy", async () => {
      const VaultFactory = await ethers.getContractFactory("MatchPickVault");
      await expect(
        upgrades.deployProxy(VaultFactory, [ethers.ZeroAddress, admin.address, settler.address], { kind: "uups" })
      ).to.be.reverted;
    });
  });

  describe("fundMatchday", () => {
    it("transfers cUSD in and tracks the funded amount", async () => {
      await expect(vault.connect(sponsor).fundMatchday(1, parse("25")))
        .to.emit(vault, "MatchdayFunded")
        .withArgs(1, sponsor.address, parse("25"), parse("25"));

      const pool = await vault.getMatchday(1);
      expect(pool.funded).to.equal(parse("25"));
      expect(await cUSD.balanceOf(await vault.getAddress())).to.equal(parse("25"));
    });

    it("accumulates across multiple funders", async () => {
      await cUSD.mint(stranger.address, parse("10"));
      await cUSD.connect(stranger).approve(await vault.getAddress(), ethers.MaxUint256);

      await vault.connect(sponsor).fundMatchday(1, parse("25"));
      await vault.connect(stranger).fundMatchday(1, parse("10"));

      expect((await vault.getMatchday(1)).funded).to.equal(parse("35"));
    });

    it("reverts on zero amount", async () => {
      await expect(vault.connect(sponsor).fundMatchday(1, 0)).to.be.revertedWithCustomError(vault, "ZeroAmount");
    });

    it("reverts once the matchday is already settled", async () => {
      await vault.connect(sponsor).fundMatchday(1, parse("10"));
      await vault.connect(settler).settleMatchday(1, [alice.address], [parse("10")]);

      await expect(vault.connect(sponsor).fundMatchday(1, parse("5"))).to.be.revertedWithCustomError(
        vault,
        "MatchdayAlreadySettled"
      );
    });

    it("reverts while paused", async () => {
      await vault.connect(admin).pause();
      await expect(vault.connect(sponsor).fundMatchday(1, parse("10"))).to.be.revertedWithCustomError(
        vault,
        "EnforcedPause"
      );
    });
  });

  describe("fundTreasury", () => {
    it("increases the treasury balance", async () => {
      await expect(vault.connect(sponsor).fundTreasury(parse("5")))
        .to.emit(vault, "TreasuryFunded")
        .withArgs(sponsor.address, parse("5"), parse("5"));
      expect(await vault.treasuryBalance()).to.equal(parse("5"));
    });

    it("reverts on zero amount", async () => {
      await expect(vault.connect(sponsor).fundTreasury(0)).to.be.revertedWithCustomError(vault, "ZeroAmount");
    });
  });

  describe("settleMatchday", () => {
    beforeEach(async () => {
      await vault.connect(sponsor).fundMatchday(1, parse("25"));
    });

    it("pays every winner and marks the matchday settled", async () => {
      const winners = [alice.address, bob.address];
      const amounts = [parse("8"), parse("5")];

      await expect(vault.connect(settler).settleMatchday(1, winners, amounts))
        .to.emit(vault, "MatchdaySettled")
        .withArgs(1, winners, amounts, parse("13"));

      expect(await cUSD.balanceOf(alice.address)).to.equal(parse("8"));
      expect(await cUSD.balanceOf(bob.address)).to.equal(parse("5"));

      const pool = await vault.getMatchday(1);
      expect(pool.settled).to.equal(true);
      expect(pool.distributed).to.equal(parse("13"));
      expect(await vault.pendingMatchdayBalance(1)).to.equal(parse("12"));
    });

    it("allows the same winner to appear more than once", async () => {
      await vault.connect(settler).settleMatchday(1, [alice.address, alice.address], [parse("1"), parse("2")]);
      expect(await cUSD.balanceOf(alice.address)).to.equal(parse("3"));
    });

    it("reverts for non-settler callers", async () => {
      await expect(vault.connect(stranger).settleMatchday(1, [alice.address], [parse("1")])).to.be
        .revertedWithCustomError(vault, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, await vault.SETTLER_ROLE());
    });

    it("reverts on mismatched array lengths", async () => {
      await expect(
        vault.connect(settler).settleMatchday(1, [alice.address, bob.address], [parse("1")])
      ).to.be.revertedWithCustomError(vault, "ArrayLengthMismatch");
    });

    it("reverts with no winners", async () => {
      await expect(vault.connect(settler).settleMatchday(1, [], [])).to.be.revertedWithCustomError(
        vault,
        "NoWinners"
      );
    });

    it("reverts if the payout total exceeds what was funded", async () => {
      await expect(
        vault.connect(settler).settleMatchday(1, [alice.address], [parse("26")])
      ).to.be.revertedWithCustomError(vault, "InsufficientMatchdayFunding");
    });

    it("reverts a second settlement of the same matchday", async () => {
      await vault.connect(settler).settleMatchday(1, [alice.address], [parse("5")]);
      await expect(
        vault.connect(settler).settleMatchday(1, [bob.address], [parse("5")])
      ).to.be.revertedWithCustomError(vault, "MatchdayAlreadySettled");
    });

    it("reverts on a zero-address winner", async () => {
      await expect(
        vault.connect(settler).settleMatchday(1, [ethers.ZeroAddress], [parse("1")])
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });

    it("reverts while paused", async () => {
      await vault.connect(admin).pause();
      await expect(
        vault.connect(settler).settleMatchday(1, [alice.address], [parse("1")])
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("reverts an oversized winners array", async () => {
      const max = Number(await vault.MAX_WINNERS_PER_SETTLEMENT());
      const winners = Array(max + 1).fill(alice.address);
      const amounts = Array(max + 1).fill(0n);
      await expect(vault.connect(settler).settleMatchday(1, winners, amounts)).to.be.revertedWithCustomError(
        vault,
        "TooManyWinners"
      );
    });

    it("blocks a reentrant call triggered from within the token transfer during settlement", async () => {
      // The reentrant call targets fundMatchday — unrestricted and would otherwise succeed on
      // its own merits (unlike re-entering settleMatchday, which would incidentally get blocked
      // by access control or the already-settled check instead of the guard). That isolates the
      // revert to the reentrancy guard itself.
      const MaliciousFactory = await ethers.getContractFactory("MaliciousReentrantToken");
      const evilToken = await MaliciousFactory.deploy();
      await evilToken.waitForDeployment();

      const VaultFactory = await ethers.getContractFactory("MatchPickVault");
      const evilVault = (await upgrades.deployProxy(
        VaultFactory,
        [await evilToken.getAddress(), admin.address, settler.address],
        { kind: "uups" }
      )) as unknown as MatchPickVault;
      await evilVault.waitForDeployment();

      await evilToken.mint(sponsor.address, parse("25"));
      await evilToken.connect(sponsor).approve(await evilVault.getAddress(), ethers.MaxUint256);
      await evilVault.connect(sponsor).fundMatchday(1, parse("25"));

      // Give the token contract itself enough balance + allowance to fund matchday 2 when it
      // reenters as msg.sender.
      await evilToken.mint(await evilToken.getAddress(), parse("10"));
      await evilToken.approveSelf(await evilVault.getAddress(), parse("10"));
      await evilToken.setAttack(await evilVault.getAddress(), 2, true);

      await expect(
        evilVault.connect(settler).settleMatchday(1, [alice.address], [parse("10")])
      ).to.be.revertedWithCustomError(evilVault, "ReentrantCall");

      // Confirm the reentrant call didn't sneak through and fund matchday 2 either.
      expect((await evilVault.getMatchday(2)).funded).to.equal(0n);
    });
  });

  describe("payReferralBonus", () => {
    beforeEach(async () => {
      await vault.connect(sponsor).fundTreasury(parse("10"));
    });

    it("pays out of the treasury balance", async () => {
      await expect(vault.connect(settler).payReferralBonus(alice.address, parse("2")))
        .to.emit(vault, "ReferralBonusPaid")
        .withArgs(alice.address, parse("2"));

      expect(await cUSD.balanceOf(alice.address)).to.equal(parse("2"));
      expect(await vault.treasuryBalance()).to.equal(parse("8"));
    });

    it("reverts for non-settler callers", async () => {
      await expect(vault.connect(stranger).payReferralBonus(alice.address, parse("1"))).to.be
        .revertedWithCustomError(vault, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, await vault.SETTLER_ROLE());
    });

    it("reverts if the amount exceeds the treasury balance", async () => {
      await expect(
        vault.connect(settler).payReferralBonus(alice.address, parse("11"))
      ).to.be.revertedWithCustomError(vault, "InsufficientTreasuryBalance");
    });

    it("reverts on zero amount or zero address", async () => {
      await expect(vault.connect(settler).payReferralBonus(alice.address, 0)).to.be.revertedWithCustomError(
        vault,
        "ZeroAmount"
      );
      await expect(
        vault.connect(settler).payReferralBonus(ethers.ZeroAddress, parse("1"))
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });
  });

  describe("reclaimExpiredMatchday", () => {
    beforeEach(async () => {
      await vault.connect(sponsor).fundMatchday(1, parse("25"));
    });

    it("reverts before RECLAIM_DELAY has passed", async () => {
      await expect(
        vault.connect(admin).reclaimExpiredMatchday(1, admin.address)
      ).to.be.revertedWithCustomError(vault, "ReclaimTooEarly");
    });

    it("sends the unsettled balance back after the delay", async () => {
      await time.increase(await vault.RECLAIM_DELAY());
      await expect(vault.connect(admin).reclaimExpiredMatchday(1, sponsor.address))
        .to.emit(vault, "ExpiredMatchdayReclaimed")
        .withArgs(1, sponsor.address, parse("25"));

      expect((await vault.getMatchday(1)).settled).to.equal(true);
    });

    it("reverts for non-admin callers", async () => {
      await time.increase(await vault.RECLAIM_DELAY());
      await expect(vault.connect(stranger).reclaimExpiredMatchday(1, stranger.address)).to.be
        .revertedWithCustomError(vault, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, ethers.ZeroHash);
    });

    it("reverts if already settled", async () => {
      await vault.connect(settler).settleMatchday(1, [alice.address], [parse("1")]);
      await time.increase(await vault.RECLAIM_DELAY());
      await expect(
        vault.connect(admin).reclaimExpiredMatchday(1, admin.address)
      ).to.be.revertedWithCustomError(vault, "MatchdayAlreadySettled");
    });
  });

  describe("emergencyWithdraw", () => {
    it("reverts unless paused", async () => {
      await expect(
        vault.connect(admin).emergencyWithdraw(await cUSD.getAddress(), admin.address, 1)
      ).to.be.revertedWithCustomError(vault, "ExpectedPause");
    });

    it("lets the admin recover stray tokens while paused", async () => {
      await cUSD.mint(await vault.getAddress(), parse("3"));
      await vault.connect(admin).pause();

      await expect(vault.connect(admin).emergencyWithdraw(await cUSD.getAddress(), admin.address, parse("3")))
        .to.emit(vault, "EmergencyWithdraw")
        .withArgs(await cUSD.getAddress(), admin.address, parse("3"));

      expect(await cUSD.balanceOf(admin.address)).to.equal(parse("3"));
    });

    it("reverts for non-admin callers", async () => {
      await vault.connect(admin).pause();
      await expect(vault.connect(stranger).emergencyWithdraw(await cUSD.getAddress(), stranger.address, 1)).to.be
        .revertedWithCustomError(vault, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, ethers.ZeroHash);
    });
  });

  describe("pause / unpause", () => {
    it("only admin can pause or unpause", async () => {
      await expect(vault.connect(stranger).pause()).to.be
        .revertedWithCustomError(vault, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, ethers.ZeroHash);

      await vault.connect(admin).pause();
      expect(await vault.paused()).to.equal(true);

      await vault.connect(admin).unpause();
      expect(await vault.paused()).to.equal(false);
    });
  });

  describe("UUPS upgrade", () => {
    it("preserves state and adds new capability", async () => {
      await vault.connect(sponsor).fundMatchday(7, parse("25"));

      const VaultV2Factory = await ethers.getContractFactory("MatchPickVaultV2");
      const upgraded = (await upgrades.upgradeProxy(await vault.getAddress(), VaultV2Factory)) as unknown as MatchPickVault & {
        version(): Promise<bigint>;
        bumpSeason(): Promise<unknown>;
        seasonCounter(): Promise<bigint>;
      };

      expect((await upgraded.getMatchday(7)).funded).to.equal(parse("25"));
      expect(await upgraded.version()).to.equal(2n);

      await upgraded.connect(admin).bumpSeason();
      expect(await upgraded.seasonCounter()).to.equal(1n);
    });

    it("reverts an upgrade attempted by a non-admin", async () => {
      const VaultV2Factory = await ethers.getContractFactory("MatchPickVaultV2", stranger);
      const newImpl = await VaultV2Factory.deploy();
      await newImpl.waitForDeployment();

      await expect(
        vault.connect(stranger).upgradeToAndCall(await newImpl.getAddress(), "0x")
      ).to.be
        .revertedWithCustomError(vault, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, ethers.ZeroHash);
    });
  });
});

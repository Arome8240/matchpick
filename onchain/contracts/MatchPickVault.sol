// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title MatchPickVault
/// @notice Holds sponsor-funded cUSD prize pools for MatchPick matchdays and pays out winners.
/// @dev Picks, fixtures, scoring and leaderboards are computed off-chain. A trusted SETTLER_ROLE
/// address (the MatchPick backend) submits final winner/amount lists per matchday and this
/// contract does nothing more than escrow funds and move them to the addresses it's told to,
/// bounded by what was actually funded for that matchday. This contract intentionally does NOT
/// verify picks or scoring on-chain — see the audit notes in README.md for the trust assumptions
/// this implies.
contract MatchPickVault is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    /// @notice Role allowed to submit matchday settlements and referral bonus payouts.
    /// @dev This is the MatchPick backend's hot wallet. It can only move funds that were already
    /// deposited via fundMatchday/fundTreasury, and only to addresses/amounts it specifies at
    /// settlement time — it cannot arbitrarily drain the vault to itself. Compromise of this key
    /// lets an attacker redirect prize payouts, which is why it should be a low-value, narrowly
    /// scoped key kept separate from DEFAULT_ADMIN_ROLE (recommended: a Gnosis Safe).
    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");

    /// @notice Minimum age a matchday's funding must reach before an admin can reclaim an
    /// unsettled balance. Protects sponsors/users from a rushed clawback while still preventing
    /// funds from being locked forever if the off-chain settlement service breaks permanently.
    uint256 public constant RECLAIM_DELAY = 30 days;

    /// @notice Sanity cap on winners per settlement call — not a security boundary (the settler
    /// is trusted), just a guard against a malformed/oversized payload wasting gas.
    uint256 public constant MAX_WINNERS_PER_SETTLEMENT = 500;

    struct MatchdayPool {
        uint256 funded;
        uint256 distributed;
        uint64 firstFundedAt;
        bool settled;
    }

    /// @notice The cUSD (or other stable) ERC20 token this vault escrows and pays out in.
    IERC20 public cUSD;

    /// @notice General-purpose funded balance not tied to a specific matchday, used for referral
    /// bonuses and other ad-hoc off-chain-triggered payouts.
    uint256 public treasuryBalance;

    mapping(uint256 => MatchdayPool) public matchdays;

    event MatchdayFunded(uint256 indexed matchdayId, address indexed sponsor, uint256 amount, uint256 totalFunded);
    event MatchdaySettled(uint256 indexed matchdayId, address[] winners, uint256[] amounts, uint256 totalDistributed);
    event TreasuryFunded(address indexed sponsor, uint256 amount, uint256 totalTreasury);
    event ReferralBonusPaid(address indexed to, uint256 amount);
    event ExpiredMatchdayReclaimed(uint256 indexed matchdayId, address indexed to, uint256 amount);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);

    error ArrayLengthMismatch();
    error TooManyWinners();
    error MatchdayAlreadySettled();
    error InsufficientMatchdayFunding();
    error InsufficientTreasuryBalance();
    error ZeroAddress();
    error ZeroAmount();
    error ReclaimTooEarly();
    error NoWinners();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @param cUSDToken Address of the cUSD ERC20 contract on the target network.
    /// @param admin Address to receive DEFAULT_ADMIN_ROLE — should be a multisig in production.
    /// @param settler Address to receive SETTLER_ROLE — the MatchPick backend's signing key.
    function initialize(address cUSDToken, address admin, address settler) external initializer {
        if (cUSDToken == address(0) || admin == address(0) || settler == address(0)) revert ZeroAddress();

        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        cUSD = IERC20(cUSDToken);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SETTLER_ROLE, settler);
    }

    // ---------------------------------------------------------------------
    // Sponsor funding
    // ---------------------------------------------------------------------

    /// @notice Fund (or top up) the prize pool for a specific matchday. Callable by anyone —
    /// this is how a sponsor deposits the weekly pool.
    function fundMatchday(uint256 matchdayId, uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        MatchdayPool storage pool = matchdays[matchdayId];
        if (pool.settled) revert MatchdayAlreadySettled();

        if (pool.firstFundedAt == 0) {
            pool.firstFundedAt = uint64(block.timestamp);
        }
        pool.funded += amount;

        cUSD.safeTransferFrom(msg.sender, address(this), amount);
        emit MatchdayFunded(matchdayId, msg.sender, amount, pool.funded);
    }

    /// @notice Fund the general treasury balance used for referral bonuses etc.
    function fundTreasury(uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        treasuryBalance += amount;
        cUSD.safeTransferFrom(msg.sender, address(this), amount);
        emit TreasuryFunded(msg.sender, amount, treasuryBalance);
    }

    // ---------------------------------------------------------------------
    // Settlement — trusted off-chain scoring service
    // ---------------------------------------------------------------------

    /// @notice Pay out a matchday's prize pool to its winners. Off-chain, the backend computes
    /// final standings (rank prizes + random draws) and submits the resulting address/amount
    /// pairs here in one transaction. Can only be called once per matchday.
    /// @param winners Recipient addresses, may contain duplicates if a player wins twice.
    /// @param amounts Amount to pay each corresponding winner, in cUSD base units.
    function settleMatchday(
        uint256 matchdayId,
        address[] calldata winners,
        uint256[] calldata amounts
    ) external onlyRole(SETTLER_ROLE) whenNotPaused nonReentrant {
        if (winners.length != amounts.length) revert ArrayLengthMismatch();
        if (winners.length == 0) revert NoWinners();
        if (winners.length > MAX_WINNERS_PER_SETTLEMENT) revert TooManyWinners();

        MatchdayPool storage pool = matchdays[matchdayId];
        if (pool.settled) revert MatchdayAlreadySettled();

        uint256 total;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }
        // pool.distributed is always 0 here today (settlement is one-shot), but the check is
        // written generally in case a future upgrade allows partial/staged settlement.
        if (total > pool.funded - pool.distributed) revert InsufficientMatchdayFunding();

        pool.settled = true;
        pool.distributed += total;

        for (uint256 i = 0; i < winners.length; i++) {
            if (winners[i] == address(0)) revert ZeroAddress();
            if (amounts[i] > 0) {
                cUSD.safeTransfer(winners[i], amounts[i]);
            }
        }

        emit MatchdaySettled(matchdayId, winners, amounts, total);
    }

    /// @notice Pay a referral bonus from the general treasury balance.
    function payReferralBonus(address to, uint256 amount) external onlyRole(SETTLER_ROLE) whenNotPaused nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > treasuryBalance) revert InsufficientTreasuryBalance();

        treasuryBalance -= amount;
        cUSD.safeTransfer(to, amount);
        emit ReferralBonusPaid(to, amount);
    }

    // ---------------------------------------------------------------------
    // Admin / recovery
    // ---------------------------------------------------------------------

    /// @notice Reclaim an unsettled matchday's funded balance after RECLAIM_DELAY has passed —
    /// covers the case where the off-chain settler is permanently broken/compromised and a
    /// matchday can never be legitimately settled. Marks the matchday settled to block any
    /// later legitimate settlement, so this should only be used once the off-chain process for
    /// that matchday is confirmed abandoned.
    function reclaimExpiredMatchday(uint256 matchdayId, address to) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        MatchdayPool storage pool = matchdays[matchdayId];
        if (pool.settled) revert MatchdayAlreadySettled();
        if (pool.firstFundedAt == 0 || block.timestamp < pool.firstFundedAt + RECLAIM_DELAY) {
            revert ReclaimTooEarly();
        }

        uint256 remaining = pool.funded - pool.distributed;
        pool.settled = true;
        if (remaining > 0) {
            cUSD.safeTransfer(to, remaining);
        }
        emit ExpiredMatchdayReclaimed(matchdayId, to, remaining);
    }

    /// @notice Escape hatch for tokens stuck in the contract (including cUSD sent outside the
    /// normal fund* flow, or an unrelated token mistakenly sent here). Only usable while paused
    /// so it can't be used to quietly siphon active prize pools during normal operation.
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) whenPaused nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit EmergencyWithdraw(token, to, amount);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getMatchday(uint256 matchdayId) external view returns (MatchdayPool memory) {
        return matchdays[matchdayId];
    }

    function pendingMatchdayBalance(uint256 matchdayId) external view returns (uint256) {
        MatchdayPool storage pool = matchdays[matchdayId];
        return pool.funded - pool.distributed;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    /// @dev Storage gap for safe future upgrades — reduce as new state variables are added.
    uint256[45] private __gap;
}

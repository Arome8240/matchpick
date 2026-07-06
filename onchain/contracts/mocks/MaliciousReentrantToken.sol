// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MatchPickVault} from "../MatchPickVault.sol";

/// @notice Test-only token that reenters MatchPickVault.settleMatchday from within transfer(),
/// used to prove the vault's nonReentrant guard actually blocks reentrancy. Real cUSD has no such
/// callback, but a hand-rolled guard on fund-custody code should be proven, not assumed.
contract MaliciousReentrantToken is ERC20 {
    MatchPickVault public target;
    uint256 public matchdayIdToReenter;
    bool public attack;

    constructor() ERC20("Evil", "EVIL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @dev Lets this contract approve the vault to pull tokens from itself, so the reentrant
    /// call below (made with this contract as msg.sender) can pass fundMatchday's transferFrom.
    function approveSelf(address spender, uint256 amount) external {
        _approve(address(this), spender, amount);
    }

    function setAttack(MatchPickVault _target, uint256 _matchdayId, bool _attack) external {
        target = _target;
        matchdayIdToReenter = _matchdayId;
        attack = _attack;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (attack) {
            attack = false; // avoid infinite recursion if the guard somehow failed
            // fundMatchday carries no role restriction and would otherwise succeed on its own
            // merits, isolating this revert to the reentrancy guard and nothing else.
            target.fundMatchday(matchdayIdToReenter, amount);
        }
        return super.transfer(to, amount);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MatchPickVault} from "../MatchPickVault.sol";

/// @notice Test-only V2 used to prove the UUPS upgrade path preserves storage and can add
/// capability. New state is appended after V1's storage (including its __gap), which is exactly
/// how a real upgrade contract should be written: never reorder or remove existing variables.
contract MatchPickVaultV2 is MatchPickVault {
    uint256 public seasonCounter;

    function version() external pure returns (uint256) {
        return 2;
    }

    function bumpSeason() external onlyRole(DEFAULT_ADMIN_ROLE) {
        seasonCounter += 1;
    }
}

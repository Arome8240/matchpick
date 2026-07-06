// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Simple mintable 18-decimal ERC20 standing in for cUSD in tests. Real cUSD is a Mento
/// stable asset that also implements Celo's fee-abstraction extensions, but from an ERC20
/// caller's perspective (transfer/transferFrom/approve/balanceOf) it behaves like this mock.
contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

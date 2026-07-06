import { ethers, upgrades } from "hardhat";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

/// Usage: PROXY_ADDRESS=0x... NEW_CONTRACT=MatchPickVaultV2 hardhat run scripts/upgrade.ts --network alfajores
async function main() {
  const proxyAddress = requireEnv("PROXY_ADDRESS");
  const newContractName = process.env.NEW_CONTRACT || "MatchPickVault";

  console.log(`Upgrading proxy at ${proxyAddress} to ${newContractName}...`);
  const NewImpl = await ethers.getContractFactory(newContractName);
  const upgraded = await upgrades.upgradeProxy(proxyAddress, NewImpl);
  await upgraded.waitForDeployment();

  console.log(`Upgrade complete. New implementation: ${await upgrades.erc1967.getImplementationAddress(proxyAddress)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

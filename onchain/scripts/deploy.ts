import { ethers, network, upgrades } from "hardhat";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function main() {
  const isAlfajores = network.name === "alfajores";
  const cUSDAddress: string = isAlfajores
    ? requireEnv("CUSD_ADDRESS_ALFAJORES")
    : network.name === "celo"
      ? requireEnv("CUSD_ADDRESS_CELO")
      : await (await deployMockCUSD()).getAddress();

  const admin = process.env.ADMIN_ADDRESS || (await ethers.getSigners())[0].address;
  const settler = process.env.SETTLER_ADDRESS || (await ethers.getSigners())[0].address;

  console.log(`Deploying MatchPickVault to ${network.name}...`);
  console.log(`  cUSD:    ${cUSDAddress}`);
  console.log(`  admin:   ${admin}`);
  console.log(`  settler: ${settler}`);

  const Vault = await ethers.getContractFactory("MatchPickVault");
  const vault = await upgrades.deployProxy(Vault, [cUSDAddress, admin, settler], {
    kind: "uups",
  });
  await vault.waitForDeployment();

  console.log(`MatchPickVault (proxy) deployed to: ${await vault.getAddress()}`);
  console.log(
    `Implementation address: ${await upgrades.erc1967.getImplementationAddress(await vault.getAddress())}`
  );
}

async function deployMockCUSD() {
  console.log("No CUSD_ADDRESS set for this network — deploying a MockERC20 for local testing.");
  const Mock = await ethers.getContractFactory("MockERC20");
  const mock = await Mock.deploy("Mock cUSD", "mCUSD");
  await mock.waitForDeployment();
  return mock;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
